---
---
/* FILE: assets/js/comment-moderation.js
 * PURPOSE: Everything the two moderator-only pages (approve.html, which
 * reviews ONE comment from an email link, and review.html, which lists
 * EVERYTHING waiting for review) need in common: Google sign-in gated to
 * the moderator, approving / rejecting a comment, the "trusted people"
 * list, and the optional emails to commenters. Kept in one place so the
 * two pages can't drift apart.
 *
 * This file has Jekyll front matter (the two dashes above) ONLY so that
 * Liquid fills in the site.* settings from _config.yml (the Firebase and
 * EmailJS values just below), exactly like _includes/firebase-comments.html
 * does. Never write two opening curly braces in a row anywhere else in
 * this file, not even in a comment, or Liquid will try to read them as a
 * template tag and the whole site build will fail.
 *
 * How it degrades (so the code can be deployed BEFORE the newer Firebase
 * rules / EmailJS template exist, in any order):
 *  - Rejecting with a note needs the updated rules. If they aren't
 *    published yet, the write is denied, we retry with the old, plain
 *    "deleted" write, and tell the moderator the note wasn't saved.
 *  - The trusted list and the private commenter records need the updated
 *    rules too; if denied, those features simply report that they need
 *    the rules update.
 *  - Emails to commenters are off unless emailjs-notify-template-id is set.
 * Automatic screening (the Cloud Function in functions/) marks a comment it
 * rejected with rejected = true and approved = false, and leaves one it could
 * not decide (held for a person, or the check failed) unapproved with an
 * autoReview note. This file treats those as the moderator's to reverse:
 * approving one clears the rejected flag, and rejecting always sets
 * approved = false so the text is no longer public.
 * See docs/comments-setup.md for the setup steps and docs/firestore.rules
 * for the rules this file expects.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "{{ site.firebase-api-key }}",
  authDomain: "{{ site.firebase-auth-domain }}",
  projectId: "{{ site.firebase-project-id }}",
  storageBucket: "{{ site.firebase-storage-bucket }}",
  messagingSenderId: "{{ site.firebase-messaging-sender-id }}",
  appId: "{{ site.firebase-app-id }}"
};

export const MODERATOR_EMAIL = "{{ site.comments-moderator-email }}";
const EMAILJS_SERVICE_ID = "{{ site.emailjs-service-id }}";
const EMAILJS_PUBLIC_KEY = "{{ site.emailjs-public-key }}";
const EMAILJS_NOTIFY_TEMPLATE_ID = "{{ site.emailjs-notify-template-id }}";
const EMAILJS_SEND_URL = "https://api.emailjs.com/api/v1.0/email/send";

/** True only when the second EmailJS template has been configured. */
export const COMMENTER_EMAILS_ENABLED = !!(EMAILJS_SERVICE_ID && EMAILJS_PUBLIC_KEY && EMAILJS_NOTIFY_TEMPLATE_ID);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// ---------------------------------------------------------------- helpers

export function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function isPermissionDenied(err) {
  return !!err && (err.code === "permission-denied" || /permission/i.test(String(err.message || "")));
}

function excerpt(text, max = 200) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// ------------------------------------------------------------------- auth

/**
 * Calls exactly one of the three callbacks whenever the sign-in state
 * changes: signedOut(), notModerator(user), or moderator(user).
 */
export function watchModerator({ signedOut, notModerator, moderator }) {
  onAuthStateChanged(auth, (user) => {
    if (!user) signedOut();
    else if (user.email !== MODERATOR_EMAIL) notModerator(user);
    else moderator(user);
  });
}
export const signInWithGoogle = () => signInWithPopup(auth, provider);
export const signOutUser = () => signOut(auth);

// --------------------------------------------- private commenter records

/**
 * The private record kept for each comment (commentPrivate/{commentId}):
 * the commenter's email and whether they asked to be emailed. Only the
 * moderator can read it. Returns null if there isn't one or it can't be read.
 */
export async function loadPrivate(commentId) {
  try {
    const snap = await getDoc(doc(db, "commentPrivate", commentId));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn("Could not read the private record for", commentId, err);
    return null;
  }
}

/** One comment's data, or null if it no longer exists. */
export async function getComment(id) {
  const snap = await getDoc(doc(db, "comments", id));
  return snap.exists() ? snap.data() : null;
}

// ---------------------------------------------------- emails to commenters

/**
 * Sends one email through the second EmailJS template. kind is
 * "approved", "rejected" or "reply". Throws if the send fails so callers can
 * report it; callers treat that as non-fatal (the decision itself is saved).
 */
async function sendCommenterEmail({ kind, to, toName, pageUrl, commentText, note, otherName }) {
  const first = String(toName || "").trim().split(/\s+/)[0] || "there";
  const link = String(pageUrl || "") + "#comments-section";
  const quote = "\u201C" + excerpt(commentText) + "\u201D";
  let subject, message, buttonLabel;
  if (kind === "approved") {
    subject = "Your comment on Sahyadri Connect is now live";
    message = "Thanks for commenting. Your comment has been approved and is now visible to everyone: " + quote;
    buttonLabel = "See your comment";
  } else if (kind === "rejected") {
    subject = "Your comment on Sahyadri Connect wasn\u2019t published";
    message = "Thanks for taking the time to comment. Your comment wasn\u2019t published: " + quote + ". " +
      (note ? "A note from the moderator: " + note + " " : "") +
      "Comments are reviewed to keep this a kind and useful space for the whole school community.";
    buttonLabel = "Back to the page";
  } else {
    subject = "Someone replied to your comment on Sahyadri Connect";
    message = (otherName || "Someone") + " replied to your comment: " + quote;
    buttonLabel = "Read the reply";
  }
  const res = await fetch(EMAILJS_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_NOTIFY_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: { to_email: to, to_name: first, subject, message, page_url: link, button_label: buttonLabel }
    })
  });
  if (res && res.ok === false) throw new Error("EmailJS returned " + res.status);
}

async function tryEmail(result, label, args) {
  try {
    await sendCommenterEmail(args);
    result.emailed.push(label);
  } catch (err) {
    console.error("Could not send the '" + args.kind + "' email:", err);
    result.warnings.push("The " + label + " could not be sent (the decision itself was saved).");
  }
}

// ------------------------------------------------------------ the decisions

/**
 * Approves a comment. Options: { trust: true } also adds the commenter to
 * the trusted list (needs their email on file). Returns
 * { emailed: [...], trusted: bool, warnings: [...] }.
 */
export async function approveComment(id, data, { trust = false } = {}) {
  const result = { emailed: [], trusted: false, warnings: [] };
  const priv = (trust || COMMENTER_EMAILS_ENABLED) ? await loadPrivate(id) : null;

  // Reversing a rejection also clears the rejected flag and its note.
  const changes = data.rejected === true
    ? { approved: true, rejected: false, moderationNote: "" }
    : { approved: true };
  await updateDoc(doc(db, "comments", id), changes);

  if (trust) {
    if (priv && priv.email) {
      try {
        await addTrusted(priv.email, data.name || "");
        result.trusted = true;
      } catch (err) {
        result.warnings.push(isPermissionDenied(err)
          ? "Could not add to the trusted list: the updated Firebase rules haven't been published yet."
          : "Could not add to the trusted list.");
      }
    } else {
      result.warnings.push("No email on file for this person, so they couldn't be trusted automatically. Add them by email under \u201CTrusted people\u201D.");
    }
  }

  if (COMMENTER_EMAILS_ENABLED) {
    if (priv && priv.notify && priv.email) {
      await tryEmail(result, "\u201Cnow live\u201D email", {
        kind: "approved", to: priv.email, toName: data.name, pageUrl: data.pageUrl, commentText: data.text
      });
    }
    // If this is a reply, let the author of the comment being replied to know.
    if (data.parentId) {
      try {
        const parentSnap = await getDoc(doc(db, "comments", data.parentId));
        const parent = parentSnap.exists() ? parentSnap.data() : null;
        if (parent && parent.approved && !parent.deleted && parent.uid !== data.uid) {
          const parentPriv = await loadPrivate(data.parentId);
          if (parentPriv && parentPriv.notify && parentPriv.email) {
            await tryEmail(result, "reply-notice email", {
              kind: "reply", to: parentPriv.email, toName: parent.name, pageUrl: data.pageUrl,
              commentText: parent.text, otherName: data.name
            });
          }
        }
      } catch (err) {
        console.warn("Could not check the parent comment for a reply notice:", err);
      }
    }
  }
  return result;
}

/**
 * Rejects a comment, optionally with a short note the commenter will see.
 * Returns { noteSaved: bool, emailed: [...], warnings: [...] }.
 */
export async function rejectComment(id, data, note = "") {
  const cleanNote = String(note || "").trim().slice(0, 500);
  const result = { noteSaved: true, emailed: [], warnings: [] };
  const ref = doc(db, "comments", id);
  try {
    await updateDoc(ref, { approved: false, deleted: true, rejected: true, moderationNote: cleanNote });
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
    // The older rules only let the moderator touch approved/deleted.
    await updateDoc(ref, { approved: false, deleted: true });
    result.noteSaved = false;
    result.warnings.push("Rejected, but the note couldn't be shown to the commenter: the updated Firebase rules haven't been published yet.");
  }
  // (No "not published" email if it had already been live: that would be misleading.)
  if (COMMENTER_EMAILS_ENABLED && data.approved !== true) {
    const priv = await loadPrivate(id);
    if (priv && priv.notify && priv.email) {
      await tryEmail(result, "\u201Cnot published\u201D email", {
        kind: "rejected", to: priv.email, toName: data.name, pageUrl: data.pageUrl,
        commentText: data.text, note: cleanNote
      });
    }
  }
  return result;
}

// ----------------------------------------------------------- pending queue

/**
 * Live view of what needs the moderator's eyes. Calls
 * onData({ waiting: [...], autoRejected: [...] }) now and on every change,
 * each list oldest first, each item { id, data }:
 *  - waiting: not yet approved and not rejected (with automatic screening
 *    these are the ones it could not decide: held, or the check failed)
 *  - autoRejected: rejected by the automatic screening and not yet confirmed
 *    or reversed by the moderator
 * Comments the moderator or author has deleted are left out.
 */
export function subscribePending(onData, onError) {
  const q = query(collection(db, "comments"), where("approved", "==", false));
  return onSnapshot(q, (snap) => {
    const waiting = [];
    const autoRejected = [];
    for (const d of snap.docs) {
      const data = d.data();
      if (data.deleted) continue;
      (data.rejected ? autoRejected : waiting).push({ id: d.id, data });
    }
    const byAge = (a, b) => millis(a.data.createdAt) - millis(b.data.createdAt);
    onData({ waiting: waiting.sort(byAge), autoRejected: autoRejected.sort(byAge) });
  }, onError);
}

/** One plain-English line about what the automatic check found ("" if it has not looked). */
export function describeAutoReview(data) {
  const r = data && data.autoReview;
  if (!r) return "";
  const score = typeof r.confidence === "number" ? r.confidence.toFixed(2) : "?";
  if (r.decision === "rejected") return "Automatically rejected: \u201C" + r.category + "\u201D scored " + score + " (rejects above " + (r.threshold ?? 0.5) + ").";
  if (r.decision === "held" && r.reason === "link") return "Held for you: it contains a web link. The automatic check can\u2019t tell a useful link from spam, so a person decides.";
  if (r.decision === "held") return "Held for you: \u201C" + r.category + "\u201D scored " + score + ". This kind of topic is never published or rejected automatically.";
  if (r.decision === "error") return "The automatic check could not run (" + (r.error || "unknown error") + "), so it is waiting for you.";
  return "";
}

export function millis(ts) {
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
}

// ---------------------------------------------------------- trusted people

const trustedId = (email) => String(email || "").trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listTrusted() {
  const snap = await getDocs(collection(db, "trusted"));
  return snap.docs
    .map((d) => ({ email: d.id, ...d.data() }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function addTrusted(email, name = "") {
  const id = trustedId(email);
  if (!EMAIL_RE.test(id)) throw new Error("That doesn't look like an email address.");
  await setDoc(doc(db, "trusted", id), { name: String(name || ""), addedAt: serverTimestamp() });
}

export async function removeTrusted(email) {
  await deleteDoc(doc(db, "trusted", trustedId(email)));
}
