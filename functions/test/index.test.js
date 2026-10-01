// Tests for functions/src/index.js. Run with:  cd functions && npm test
// The Google language API, Gmail and Firestore are replaced with in-memory
// stand-ins, so nothing here touches the network or a real project.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// The function waits a few seconds for the private record (see PRIVATE_LOOKUP_*). Scale every
// timer of a second or more down 40x so the tests finish fast while keeping their ordering
// (retries are still spaced out, and a "late" record still arrives between them).
const realSetTimeout = global.setTimeout;
global.setTimeout = (fn, ms, ...args) => realSetTimeout(fn, ms >= 1000 ? Math.round(ms / 40) : ms, ...args);

// ---------------- stand-ins ----------------
const docs = new Map();                 // "comments/abc" -> data
const sent = [];                        // emails "sent"
let categories = [];                    // what moderateText returns next
let languageError = null;               // make moderateText fail
let languageCalls = 0;
let mailError = null;
let updateError = null;
const captured = {};

const TS = { serverTimestamp: true };
function snapOf(path) { const d = docs.get(path); return { exists: d !== undefined, data: () => (d ? JSON.parse(JSON.stringify(d)) : undefined) }; }
const fakeDb = { collection: (col) => ({ doc: (id) => ({
  get: async () => snapOf(`${col}/${id}`),
  update: async (changes) => { if (updateError) throw updateError; docs.set(`${col}/${id}`, { ...docs.get(`${col}/${id}`), ...changes }); },
}) }) };
const fakeAdmin = { initializeApp() {}, firestore: Object.assign(() => fakeDb, { FieldValue: { serverTimestamp: () => TS } }) };

const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'firebase-functions/v2/firestore') return { onDocumentCreated: (opts, handler) => { captured.opts = opts; captured.handler = handler; return handler; } };
  if (request === 'firebase-functions/params') return { defineSecret: (name) => ({ value: () => `secret-${name}` }) };
  if (request === 'firebase-admin') return fakeAdmin;
  if (request === 'nodemailer') return { createTransport: () => ({ sendMail: async (m) => { if (mailError) throw mailError; sent.push(m); } }) };
  if (request === '@google-cloud/language') return { LanguageServiceClient: class { async moderateText() { languageCalls++; if (languageError) throw languageError; return [{ moderationCategories: categories }]; } } };
  return realLoad.apply(this, arguments);
};
require('../src/index.js');
const handler = captured.handler;
console.log = () => {}; console.warn = () => {}; console.error = () => {};

// ---------------- helpers ----------------
function reset() { docs.clear(); sent.length = 0; categories = []; languageError = null; languageCalls = 0; mailError = null; updateError = null; }
const PAGE = 'https://connect.sahyadrischool.org/posts/photo';
function seed(id, data) { docs.set(`comments/${id}`, { text: 'A kind comment', pageUrl: PAGE, uid: 'u_asha', name: 'Asha Rao', approved: false, deleted: false, parentId: null, ...data }); }
function priv(id, data) { docs.set(`commentPrivate/${id}`, { uid: 'u_asha', email: 'asha@example.com', name: 'Asha Rao', notify: true, ...data }); }
async function run(id) {
  const current = docs.get(`comments/${id}`);
  await handler({ params: { commentId: id }, data: { data: () => JSON.parse(JSON.stringify(current)), ref: { get: async () => snapOf(`comments/${id}`) } } });
}
const cat = (name, confidence) => ({ name, confidence });
const to = (addr) => sent.filter((m) => m.to === addr);
const doc = (id) => docs.get(`comments/${id}`);

// ---------------- tests ----------------
test('deploy settings: region, secrets and limits', () => {
  assert.equal(captured.opts.document, 'comments/{commentId}');
  assert.equal(captured.opts.region, 'asia-south1');
  assert.equal(captured.opts.maxInstances, 5);
  assert.equal(captured.opts.secrets.length, 2);
});

test('a clean comment is approved and the moderator is told', async () => {
  reset(); seed('c1'); categories = [cat('Toxic', 0.05), cat('Insult', 0.02)];
  await run('c1');
  assert.equal(doc('c1').approved, true); assert.equal(doc('c1').rejected, undefined); assert.equal(doc('c1').autoReview, undefined);
  assert.equal(to('archives@sahyadrischool.org').length, 1);
  assert.match(to('archives@sahyadrischool.org')[0].html, /AUTO-APPROVED/);
  assert.match(to('archives@sahyadrischool.org')[0].html, /approve\.html\?id=c1/);
});

test('REGRESSION: sensitive TOPICS (religion, politics, health) never cause a rejection', async () => {
  reset(); seed('c1', { text: 'Krishnamurti asked whether belief divides us.' });
  categories = [cat('Religion & Belief', 0.97), cat('Politics', 0.9), cat('Health', 0.8), cat('Legal', 0.7), cat('Finance', 0.6), cat('War & Conflict', 0.7), cat('Toxic', 0.03)];
  await run('c1');
  assert.equal(doc('c1').approved, true);
});

test('a harmful category over the threshold rejects, with a friendly note and no scores shown to the commenter', async () => {
  reset(); seed('c1', { text: 'You are an idiot' }); priv('c1'); categories = [cat('Toxic', 0.81), cat('Insult', 0.7)];
  await run('c1');
  const d = doc('c1');
  assert.equal(d.approved, false); assert.equal(d.rejected, true);
  assert.match(d.moderationNote, /held back by an automatic check/); assert.doesNotMatch(d.moderationNote, /0\.81|Toxic/);
  assert.equal(d.autoReview.decision, 'rejected'); assert.equal(d.autoReview.category, 'Toxic'); assert.equal(d.autoReview.confidence, 0.81);
  assert.match(to('archives@sahyadrischool.org')[0].html, /AUTO-REJECTED \(Toxic, confidence 0\.810/);
  const mine = to('asha@example.com'); assert.equal(mine.length, 1);
  assert.match(mine[0].subject, /wasn.t published/); assert.doesNotMatch(mine[0].html, /0\.81|Toxic/);
});

test('exactly at the threshold is NOT rejected (the rule is "above")', async () => {
  reset(); seed('c1'); categories = [cat('Toxic', 0.5)]; await run('c1'); assert.equal(doc('c1').approved, true);
});

test('category names are matched case-insensitively', async () => {
  reset(); seed('c1'); categories = [cat('  TOXIC ', 0.9)]; await run('c1'); assert.equal(doc('c1').rejected, true);
});

test('a sensitive-safety category is HELD for a person: not approved, not rejected, no email to the commenter', async () => {
  reset(); seed('c1', { text: 'I feel hopeless lately' }); priv('c1'); categories = [cat('Death, Harm & Tragedy', 0.72), cat('Toxic', 0.05)];
  await run('c1');
  const d = doc('c1'); assert.equal(d.approved, false); assert.equal(d.rejected, undefined);
  assert.equal(d.autoReview.decision, 'held'); assert.equal(d.autoReview.category, 'Death, Harm & Tragedy');
  assert.match(to('archives@sahyadrischool.org')[0].html, /HELD FOR YOUR REVIEW/); assert.equal(to('asha@example.com').length, 0);
});

test('LINKS: a comment that would be approved but contains a web link is HELD for a person (spam safeguard)', async () => {
  for (const text of ['Great read! Visit https://cheap-watches.example for more', 'see www.example.in now', 'get it at bestdeals.com today', 'HTTP://X.CO/abc']) {
    reset(); seed('c1', { text }); priv('c1'); categories = [cat('Toxic', 0.02)];
    await run('c1');
    const d = doc('c1'); assert.equal(d.approved, false, text); assert.equal(d.rejected, undefined, text);
    assert.equal(d.autoReview.decision, 'held', text); assert.equal(d.autoReview.reason, 'link', text);
    assert.match(to('archives@sahyadrischool.org')[0].html, /HELD FOR YOUR REVIEW \(it contains a web link/, text);
    assert.equal(to('asha@example.com').length, 0, text);
  }
});

test('LINKS: ordinary sentences are not mistaken for links', async () => {
  for (const text of ['I loved the CPR session, e.g. the part about breathing. Thanks!', 'It was great.Thanks to everyone', 'See you at 3.30 pm', 'The grade 8 project (animal farm) was wonderful', 'Mr.Sharma was there']) {
    reset(); seed('c1', { text }); categories = [cat('Toxic', 0.02)];
    await run('c1');
    assert.equal(doc('c1').approved, true, text);
  }
});

test('LINKS: harmful language is still REJECTED even if the comment also has a link', async () => {
  reset(); seed('c1', { text: 'you idiot, go to http://x.example' }); categories = [cat('Insult', 0.91)];
  await run('c1');
  assert.equal(doc('c1').rejected, true); assert.equal(doc('c1').autoReview.decision, 'rejected');
});

test('LINKS: comments created already approved (school accounts, trusted people) are never held for a link', async () => {
  reset(); seed('c1', { approved: true, text: 'Notes are at https://drive.google.com/x' });
  await run('c1');
  assert.equal(doc('c1').approved, true); assert.equal(languageCalls, 0); assert.equal(doc('c1').autoReview, undefined);
});

test('screening failure fails CLOSED: left unapproved, error recorded, moderator told', async () => {
  reset(); seed('c1'); languageError = new Error('Language not supported');
  await run('c1');
  const d = doc('c1'); assert.equal(d.approved, false); assert.equal(d.autoReview.decision, 'error'); assert.match(d.autoReview.error, /not supported/);
  assert.match(to('archives@sahyadrischool.org')[0].html, /COULD NOT AUTO-SCREEN/); assert.match(to('archives@sahyadrischool.org')[0].html, /not supported/);
});

test('no categories at all counts as clean', async () => {
  reset(); seed('c1'); categories = []; await run('c1'); assert.equal(doc('c1').approved, true);
});

test('a comment created already approved is not screened, changed, or emailed to the moderator', async () => {
  reset(); seed('c1', { approved: true }); categories = [cat('Toxic', 0.99)];
  await run('c1');
  assert.equal(languageCalls, 0); assert.equal(doc('c1').rejected, undefined); assert.equal(sent.length, 0);
});

test('a school-domain comment that arrived UNapproved (e.g. old rules) is screened like anyone, not left stuck', async () => {
  reset(); seed('c1', { uid: 'u_teacher', name: 'Swati' }); categories = [cat('Toxic', 0.01)];
  await run('c1'); assert.equal(languageCalls, 1); assert.equal(doc('c1').approved, true);
});

test('duplicate delivery / already-decided comments are skipped', async () => {
  for (const extra of [{ approved: true }, { rejected: true }, { deleted: true }, { autoReview: { decision: 'held' } }]) {
    reset(); seed('c1'); const initial = { ...doc('c1') };
    const current = { ...initial, ...extra }; docs.set('comments/c1', current);
    await handler({ params: { commentId: 'c1' }, data: { data: () => initial, ref: { get: async () => snapOf('comments/c1') } } });
    assert.equal(languageCalls, 0, JSON.stringify(extra)); assert.equal(sent.length, 0);
  }
});

test('a screened-approved comment emails the commenter only if they opted in', async () => {
  reset(); seed('c1'); priv('c1', { notify: false }); categories = [cat('Toxic', 0.01)]; await run('c1'); assert.equal(to('asha@example.com').length, 0);
  reset(); seed('c1'); priv('c1'); categories = [cat('Toxic', 0.01)]; await run('c1');
  assert.equal(to('asha@example.com').length, 1); assert.match(to('asha@example.com')[0].subject, /now live/);
  assert.match(to('asha@example.com')[0].html, /#comments-section/);
});

test('replies: the author of the parent is emailed on publication (screened OR pre-approved)', async () => {
  for (const preApproved of [false, true]) {
    reset();
    seed('p', { approved: true, uid: 'u_ben', name: 'Ben Thomas', text: 'My original thought' }); priv('p', { uid: 'u_ben', email: 'ben@example.com', notify: true });
    seed('r', { parentId: 'p', approved: preApproved, text: 'I agree!' }); priv('r', { notify: false }); categories = [cat('Toxic', 0.01)];
    await run('r');
    const toBen = to('ben@example.com'); assert.equal(toBen.length, 1, `preApproved=${preApproved}`);
    assert.match(toBen[0].subject, /replied to your comment/); assert.match(toBen[0].html, /Asha Rao replied/); assert.match(toBen[0].html, /My original thought/);
  }
});

test('replies: nothing to the parent author if they opted out, replied to themselves, or the parent is not live', async () => {
  const cases = [
    { parent: { uid: 'u_ben' }, priv: { uid: 'u_ben', email: 'ben@example.com', notify: false } },
    { parent: { uid: 'u_asha' }, priv: { uid: 'u_asha', email: 'asha@example.com', notify: true } },
    { parent: { uid: 'u_ben', approved: false }, priv: { uid: 'u_ben', email: 'ben@example.com', notify: true } },
    { parent: { uid: 'u_ben', deleted: true }, priv: { uid: 'u_ben', email: 'ben@example.com', notify: true } },
  ];
  for (const c of cases) {
    reset(); seed('p', { approved: true, ...c.parent }); priv('p', c.priv); seed('r', { parentId: 'p' }); priv('r', { notify: false }); categories = [cat('Toxic', 0.01)];
    await run('r'); assert.equal(sent.filter((m) => m.to !== 'archives@sahyadrischool.org').length, 0, JSON.stringify(c));
  }
});

test('the private record arriving a moment after the comment is still found (race)', async () => {
  reset(); seed('c1'); categories = [cat('Toxic', 0.01)];
  setTimeout(() => priv('c1'), 1500);   // scaled down with everything else: arrives between two retries
  await run('c1'); assert.equal(to('asha@example.com').length, 1);
});

test('no private record ever: no commenter email, and nothing crashes', async () => {
  reset(); seed('c1'); categories = [cat('Toxic', 0.01)]; await run('c1');
  assert.equal(doc('c1').approved, true); assert.equal(sent.filter((m) => m.to !== 'archives@sahyadrischool.org').length, 0);
});

test('an email failure never undoes or blocks the decision', async () => {
  reset(); seed('c1'); priv('c1'); categories = [cat('Toxic', 0.9)]; mailError = new Error('SMTP down');
  await run('c1'); assert.equal(doc('c1').rejected, true);
});

test('a failure to record the decision still tells the moderator', async () => {
  reset(); seed('c1'); categories = [cat('Toxic', 0.01)]; updateError = new Error('write failed');
  await run('c1'); assert.equal(doc('c1').approved, false); assert.equal(to('archives@sahyadrischool.org').length, 1);
});

test('emails never link outside this site, and never inject comment HTML', async () => {
  reset(); seed('c1', { text: '<script>alert(1)</script> hi', pageUrl: 'https://evil.example/phish', name: '<b>X</b>' }); priv('c1'); categories = [cat('Toxic', 0.01)];
  await run('c1');
  for (const m of sent) {
    assert.doesNotMatch(m.html, /evil\.example/); assert.doesNotMatch(m.html, /<script>/); assert.doesNotMatch(m.html, /<b>X<\/b>/);
  }
  assert.match(to('asha@example.com')[0].html, /connect\.sahyadrischool\.org\/#comments-section/);
});
