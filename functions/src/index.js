/**
 * Sahyadri Connect: automated comment moderation (Firebase Cloud Function)
 * ========================================================================
 *
 * WHAT THIS DOES
 * --------------
 * moderateNewComment runs every time a document is created in /comments.
 *
 *  1. A comment that was created ALREADY APPROVED (the firestore.rules only
 *     allow that for @sahyadrischool.org accounts and for people on the
 *     moderator's trusted list) is not screened. If it is a reply, the person
 *     who wrote the comment being replied to is emailed (if they asked to be).
 *
 *  2. Any other comment (created unapproved) is sent to Google's Cloud Natural
 *     Language API (moderateText) and the result is turned into one of:
 *       - APPROVED  no harmful category above the threshold. The comment goes
 *                   live, and the commenter (and, for a reply, the author of
 *                   the comment replied to) are emailed if they opted in.
 *       - REJECTED  a HARMFUL category (see HARM_CATEGORIES) scored above
 *                   RISK_REJECT_THRESHOLD. It is not published; the commenter
 *                   sees a plain "not published" note on the page.
 *       - HELD      a sensitive-SAFETY category (see HOLD_CATEGORIES) scored
 *                   above the threshold. It is left unapproved for the human
 *                   moderator to decide (never auto-published, never
 *                   auto-rejected).
 *       - HELD (links) the language check only finds harmful language; it cannot
 *                   tell spam or promotion. So a comment that would otherwise be
 *                   published automatically but contains a web link is held for
 *                   the moderator instead (see LINK_RE). Comments from school
 *                   accounts and trusted people are not screened at all.
 *       - ERROR     the screening call failed or timed out. Left unapproved
 *                   (fail closed) for the moderator, with the error recorded.
 *     Every decision is emailed to the moderator, with a link to approve.html
 *     where it can be reversed. The review queue (review.html) lists rejected,
 *     held and errored comments too, so nothing sits unseen.
 *
 * WHY ONLY SOME CATEGORIES COUNT (a change from the first version)
 * ----------------------------------------------------------------
 * moderateText returns 16 categories. Six are about HARMFUL language (Toxic,
 * Insult, Profanity, Derogatory, Violent, Sexual). The other ten are just
 * sensitive TOPICS (Religion & Belief, Politics, Health, Finance, Legal, War &
 * Conflict, and so on), and Google's own documentation says the scores say the
 * text belongs to the topic, not how severe or harmful it is. Taking the
 * highest score across ALL sixteen would auto-reject an ordinary, kind comment
 * about religion, philosophy, politics or health, which on a school site with
 * a Krishnamurti section would be constant. So only HARM_CATEGORIES can reject,
 * HOLD_CATEGORIES send it to a person, and the topic categories are ignored.
 *
 * SETUP (before deploying; full steps in docs/auto-moderation-setup.md)
 * ---------------------------------------------------------------------
 *  - The Firebase project must be on the paid Blaze plan (Cloud Functions
 *    cannot be deployed otherwise).
 *  - Enable the Cloud Natural Language API for the project.
 *  - FUNCTION_REGION below must be the same as your Firestore database's
 *    location (Firebase console > Firestore Database > Data tab).
 *  - Set two secrets used to send email through a Gmail account:
 *        firebase functions:secrets:set GMAIL_USER
 *        firebase functions:secrets:set GMAIL_APP_PASSWORD
 *    (an App Password from myaccount.google.com/apppasswords, never the
 *    account's real password).
 *  - Deploy:  firebase deploy --only functions
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { LanguageServiceClient } = require('@google-cloud/language');

admin.initializeApp();
const db = admin.firestore();
const languageClient = new LanguageServiceClient();

const GMAIL_USER = defineSecret('GMAIL_USER');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');

// ------------------------------------------------------------ settings
// MUST equal your Firestore database's location, or the trigger won't deploy.
const FUNCTION_REGION = 'asia-south1';
const MODERATOR_EMAIL = 'archives@sahyadrischool.org';
const SITE_URL = 'https://connect.sahyadrischool.org';
const RISK_REJECT_THRESHOLD = 0.5;

// Auto-REJECT above the threshold.
const HARM_CATEGORIES = ['Toxic', 'Insult', 'Profanity', 'Derogatory', 'Violent', 'Sexual'];
// Never auto-publish, never auto-reject: leave for a person above the threshold.
const HOLD_CATEGORIES = ['Death, Harm & Tragedy', 'Public Safety', 'Illicit Drugs', 'Firearms & Weapons'];
// Everything else moderateText returns (Religion & Belief, Politics, Health,
// Finance, Legal, War & Conflict) is a topic, not a harm, and is ignored.

// A web address in an outsider's comment is held for a person, because the language check
// finds abusive language but not spam. Deliberately simple and a little over-eager: a false
// alarm only costs the moderator a glance, whereas published spam costs more.
const LINK_RE = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|info|biz|xyz|shop|online|site|link)\b)/i;

const SCREEN_TIMEOUT_MS = 8000;
const PRIVATE_LOOKUP_ATTEMPTS = 4;     // the browser writes the private record just after the comment
const PRIVATE_LOOKUP_DELAY_MS = 1200;

const FRIENDLY_REJECTION_NOTE =
  'This comment was held back by an automatic check for language that may be unkind or unsuitable. ' +
  'The moderator has been told and will look at it; if it was a mistake it will be published.';

// ------------------------------------------------------------ helpers
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function excerpt(text, max = 200) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '\u2026' : t;
}

// A comment's pageUrl is written by the visitor's browser, so never trust it
// as a link target: only links back to this site are used in emails.
function safePageLink(pageUrl) {
  const u = String(pageUrl || '');
  return (u === SITE_URL || u.startsWith(SITE_URL + '/')) ? u : SITE_URL + '/';
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function norm(name) { return String(name || '').trim().toLowerCase(); }

/**
 * Turns moderateText's category list into a decision. Pure function.
 * Returns { decision: 'approved'|'rejected'|'held', category, confidence }.
 */
function assess(categories) {
  const harm = new Set(HARM_CATEGORIES.map(norm));
  const hold = new Set(HOLD_CATEGORIES.map(norm));
  let harmTop = null;
  let holdTop = null;
  for (const c of categories || []) {
    const n = norm(c.name);
    const conf = Number(c.confidence) || 0;
    if (harm.has(n) && (!harmTop || conf > harmTop.confidence)) harmTop = { name: c.name, confidence: conf };
    if (hold.has(n) && (!holdTop || conf > holdTop.confidence)) holdTop = { name: c.name, confidence: conf };
  }
  if (harmTop && harmTop.confidence > RISK_REJECT_THRESHOLD) {
    return { decision: 'rejected', category: harmTop.name, confidence: harmTop.confidence };
  }
  if (holdTop && holdTop.confidence > RISK_REJECT_THRESHOLD) {
    return { decision: 'held', category: holdTop.name, confidence: holdTop.confidence };
  }
  return { decision: 'approved', category: harmTop ? harmTop.name : null, confidence: harmTop ? harmTop.confidence : 0 };
}

async function screenText(text) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Cloud Natural Language request timed out')), SCREEN_TIMEOUT_MS);
  });
  try {
    const [response] = await Promise.race([
      languageClient.moderateText({ document: { type: 'PLAIN_TEXT', content: text } }),
      timeout,
    ]);
    return assess(response.moderationCategories || []);
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------ email
function buildTransport(user, pass) {
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
}

async function sendMail(transport, from, { to, subject, html }) {
  await transport.sendMail({ from, to, subject, html });
}

function frame(bodyHtml, linkUrl, buttonLabel) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 520px; color: #3E3830;">
      ${bodyHtml}
      ${linkUrl ? `<p style="margin: 22px 0;"><a href="${escapeHtml(linkUrl)}" style="background:#668571;color:#fff;text-decoration:none;padding:10px 22px;border-radius:20px;display:inline-block;">${escapeHtml(buttonLabel)}</a></p>` : ''}
    </div>`;
}

/** The email the moderator gets for every decision. */
async function emailModerator(transport, from, { commentId, comment, outcome, error }) {
  let status;
  if (error) status = 'COULD NOT AUTO-SCREEN. Left unapproved: please review by hand.';
  else if (outcome.decision === 'approved') status = `AUTO-APPROVED (highest harm score: ${outcome.category || 'none'} ${outcome.confidence.toFixed(3)})`;
  else if (outcome.decision === 'rejected') status = `AUTO-REJECTED (${outcome.category}, confidence ${outcome.confidence.toFixed(3)}, threshold ${RISK_REJECT_THRESHOLD})`;
  else if (outcome.reason === 'link') status = 'HELD FOR YOUR REVIEW (it contains a web link; the automatic check cannot tell a useful link from spam). Not published.';
  else status = `HELD FOR YOUR REVIEW (${outcome.category}, confidence ${outcome.confidence.toFixed(3)}). Not published.`;
  const subjectWord = error ? 'needs manual review' : outcome.decision === 'held' ? 'held for review' : outcome.decision;
  const html = frame(`
      <p><strong>${escapeHtml(status)}</strong></p>
      ${error ? `<p style="color:#b00"><strong>Error detail:</strong> ${escapeHtml(error)}</p>` : ''}
      <p><strong>${escapeHtml(comment.name || 'Someone')}</strong> commented on
         <a href="${escapeHtml(safePageLink(comment.pageUrl))}">${escapeHtml(safePageLink(comment.pageUrl))}</a></p>
      <blockquote style="border-left:3px solid #ccc;padding-left:1em;margin-left:0;white-space:pre-wrap;">${escapeHtml(String(comment.text || '').slice(0, 2000))}</blockquote>
      <p style="font-size:12px;color:#767268;">Comment ID: ${escapeHtml(commentId)}</p>
      <p><a href="${SITE_URL}/review.html">See everything waiting for review</a></p>`,
    `${SITE_URL}/approve.html?id=${encodeURIComponent(commentId)}`, 'Review or reverse this decision');
  await sendMail(transport, from, { to: MODERATOR_EMAIL, subject: `[Sahyadri Connect] Comment ${subjectWord}`, html });
}

/** Emails to commenters. Only ever sent to someone who ticked "email me". */
async function emailCommenter(transport, from, { kind, to, toName, pageUrl, commentText, otherName }) {
  const first = String(toName || '').trim().split(/\s+/)[0] || 'there';
  const quote = '\u201C' + excerpt(commentText) + '\u201D';
  let subject; let message; let button;
  if (kind === 'approved') {
    subject = 'Your comment on Sahyadri Connect is now live';
    message = `Thanks for commenting. Your comment has been approved and is now visible to everyone: ${quote}`;
    button = 'See your comment';
  } else if (kind === 'rejected') {
    subject = 'Your comment on Sahyadri Connect wasn\u2019t published';
    message = `Thanks for taking the time to comment. Your comment wasn\u2019t published: ${quote}. ` +
      'It was held back by an automatic check for language that may be unkind or unsuitable, and the moderator has been told. ' +
      `If you think this was a mistake, you are welcome to write to ${MODERATOR_EMAIL}.`;
    button = 'Back to the page';
  } else {
    subject = 'Someone replied to your comment on Sahyadri Connect';
    message = `${otherName || 'Someone'} replied to your comment: ${quote}`;
    button = 'Read the reply';
  }
  const html = frame(
    `<p>Hi ${escapeHtml(first)},</p><p>${escapeHtml(message)}</p>` +
    '<p style="font-size:12px;color:#767268;">You are getting this because you asked to be emailed about your comments on Sahyadri Connect. To stop, untick &ldquo;Email me&rdquo; the next time you comment.</p>',
    `${safePageLink(pageUrl)}#comments-section`, button);
  await sendMail(transport, from, { to, subject, html });
}

// ------------------------------------------------------------ private records
async function getPrivate(commentId) {
  const snap = await db.collection('commentPrivate').doc(commentId).get();
  return snap.exists ? snap.data() : null;
}

// The browser saves the private record a moment AFTER the comment, so it may
// not exist yet when this function starts. Look a few times before giving up.
async function getPrivateWithRetry(commentId) {
  for (let i = 0; i < PRIVATE_LOOKUP_ATTEMPTS; i++) {
    try {
      const priv = await getPrivate(commentId);
      if (priv) return priv;
    } catch (err) {
      console.warn(`Could not read commentPrivate/${commentId}:`, err.message);
    }
    if (i < PRIVATE_LOOKUP_ATTEMPTS - 1) await sleep(PRIVATE_LOOKUP_DELAY_MS);
  }
  return null;
}

/**
 * A comment is now live. Tell the commenter (if this decision was made here
 * and they asked) and the author of the comment being replied to (if any).
 * Never throws: failing to send an email must never undo a decision.
 */
async function announcePublished(transport, from, commentId, comment, { emailCommenterToo }) {
  if (emailCommenterToo) {
    try {
      const priv = await getPrivateWithRetry(commentId);
      if (priv && priv.notify && priv.email) {
        await emailCommenter(transport, from, { kind: 'approved', to: priv.email, toName: comment.name, pageUrl: comment.pageUrl, commentText: comment.text });
      }
    } catch (err) { console.error(`Could not email the commenter about ${commentId}:`, err); }
  }
  if (comment.parentId) {
    try {
      const parentSnap = await db.collection('comments').doc(comment.parentId).get();
      const parent = parentSnap.exists ? parentSnap.data() : null;
      if (parent && parent.approved === true && !parent.deleted && parent.uid !== comment.uid) {
        const parentPriv = await getPrivate(comment.parentId);
        if (parentPriv && parentPriv.notify && parentPriv.email) {
          await emailCommenter(transport, from, { kind: 'reply', to: parentPriv.email, toName: parent.name, pageUrl: comment.pageUrl, commentText: parent.text, otherName: comment.name });
        }
      }
    } catch (err) { console.error(`Could not send the reply notice for ${commentId}:`, err); }
  }
}

// ------------------------------------------------------------ the trigger
exports.moderateNewComment = onDocumentCreated(
  {
    document: 'comments/{commentId}',
    region: FUNCTION_REGION,
    secrets: [GMAIL_USER, GMAIL_APP_PASSWORD],
    maxInstances: 5,
    timeoutSeconds: 60,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const comment = snap.data();
    const commentId = event.params.commentId;

    const gmailUser = GMAIL_USER.value();
    const transport = buildTransport(gmailUser, GMAIL_APP_PASSWORD.value());

    // 1. Created already approved (school account or trusted person): no screening.
    if (comment.approved === true) {
      console.log(`Comment ${commentId} was created pre-approved; not screening.`);
      await announcePublished(transport, gmailUser, commentId, comment, { emailCommenterToo: false });
      return;
    }

    // Guard against a duplicate delivery, or a comment already deleted / decided.
    try {
      const fresh = (await snap.ref.get()).data() || {};
      if (fresh.approved === true || fresh.rejected === true || fresh.deleted === true || fresh.autoReview) {
        console.log(`Comment ${commentId} was already handled; skipping.`);
        return;
      }
    } catch (err) { /* if the re-read fails, carry on and screen it */ }

    // 2. Screen it.
    let outcome = null;
    let screeningError = null;
    try {
      outcome = await screenText(comment.text || '');
      if (outcome.decision === 'approved' && LINK_RE.test(comment.text || '')) {
        outcome = { decision: 'held', reason: 'link', category: 'Web link', confidence: 1 };
      }
    } catch (err) {
      screeningError = (err && err.message) || String(err);
      console.error(`Screening failed for comment ${commentId}:`, err);
    }

    // 3. Record the decision. Errors here are logged, not thrown, so the
    //    moderator still gets told.
    try {
      const at = admin.firestore.FieldValue.serverTimestamp();
      const ref = db.collection('comments').doc(commentId);
      if (screeningError) {
        await ref.update({ autoReview: { decision: 'error', error: screeningError.slice(0, 300), at } });
      } else if (outcome.decision === 'approved') {
        await ref.update({ approved: true });
      } else if (outcome.decision === 'rejected') {
        await ref.update({
          approved: false,
          rejected: true,
          moderationNote: FRIENDLY_REJECTION_NOTE,
          autoReview: { decision: 'rejected', category: outcome.category, confidence: outcome.confidence, threshold: RISK_REJECT_THRESHOLD, at },
        });
      } else {
        await ref.update({
          autoReview: { decision: 'held', category: outcome.category, confidence: outcome.confidence, threshold: RISK_REJECT_THRESHOLD, at, ...(outcome.reason ? { reason: outcome.reason } : {}) },
        });
      }
    } catch (err) {
      console.error(`Could not record the decision for comment ${commentId}:`, err);
    }

    // 4. Tell people.
    try {
      await emailModerator(transport, gmailUser, { commentId, comment, outcome, error: screeningError });
    } catch (err) { console.error(`Failed to email the moderator about ${commentId}:`, err); }

    if (!screeningError && outcome.decision === 'approved') {
      await announcePublished(transport, gmailUser, commentId, comment, { emailCommenterToo: true });
    } else if (!screeningError && outcome.decision === 'rejected') {
      try {
        const priv = await getPrivateWithRetry(commentId);
        if (priv && priv.notify && priv.email) {
          await emailCommenter(transport, gmailUser, { kind: 'rejected', to: priv.email, toName: comment.name, pageUrl: comment.pageUrl, commentText: comment.text });
        }
      } catch (err) { console.error(`Could not email the commenter about ${commentId}:`, err); }
    }
  }
);
