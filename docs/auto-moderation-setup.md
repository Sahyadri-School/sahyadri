# Automatic comment screening: setup and day-to-day use

This turns on a small program (a Firebase **Cloud Function**) that looks at each new
comment from an outside account within seconds, publishes the ordinary ones, and holds
back the rest for you. It is **off until you finish the steps below**; until then the
site behaves exactly as it does now, with every comment waiting for you.

The other guide, `comments-setup.md`, covers the review queue, trusted people and
emails to commenters. Read this one first if you are switching screening on.

## What it does

| Who comments | What happens |
|---|---|
| A **school account** (`@sahyadrischool.org`) or a **trusted person** | Published immediately. Never screened. |
| **Anyone else**, ordinary comment | Screened. If nothing harmful is found it is published within a few seconds. |
| **Anyone else**, harmful language | Not published. The commenter sees "Not published" with a plain note (never the scores). You are emailed and can reverse it. |
| **Anyone else**, mentions a sensitive safety topic (death or harm, weapons, drugs, public safety) | **Held for you.** Neither published nor rejected until you decide. |
| **Anyone else**, contains a web link | **Held for you.** The check finds harmful language, not spam, so links wait for a person. |
| The check itself fails or times out | Left unpublished and you are emailed (it never publishes when unsure). |

You are emailed about **every** decision, with a button to review or reverse it. Anything
automatically rejected, held, or not checked also appears on `review.html`, so nothing is
hidden without a trace.

**What "harmful" means.** Google's service scores each comment for 16 categories. Only six
measure harm and can reject a comment: Toxic, Insult, Profanity, Derogatory, Violent,
Sexual (rejected above a score of 0.5). Four safety topics hold a comment for you. The rest
(Religion & Belief, Politics, Health, Finance, Legal, War & Conflict) only say what a text is
*about*, and are ignored, so a kind comment about faith, philosophy or health is not
penalised.

## Decide these first

1. **School accounts are published without any review.** If students use
   `@sahyadrischool.org` accounts, their comments appear instantly and no one reads them
   unless they are reported. This follows the policy in the files supplied. To change it you
   must edit `isSchoolAccount()` in `docs/firestore.rules` (and re-publish the rules); the
   `comments-auto-approve-domain` setting in `_config.yml` only controls whether the page asks
   for it. Blank that setting *and* change the rules to turn it off fully.
2. **Outside comments publish on their own.** The check will not catch spam that contains no
   links and no harmful words, or content that is unkind in a way the model does not detect.
   It reduces your workload; it does not replace judgement. Look at your "automatically
   approved" emails now and then, especially in the first weeks.
3. **Outside commenters can no longer edit a comment.** They can delete it and post again
   (which is screened again). Otherwise someone could post something harmless, wait for it to
   be approved, then edit it into something else. School accounts and trusted people can still
   edit.

## What you need

- **Billing on the Firebase project (the "Blaze" plan).** Cloud Functions cannot be deployed
  on the free plan. A card is required. At this site's volume the cost should be very small,
  but it is the first part of the site that can generate a bill, so set a **budget alert**
  (Google Cloud console, Billing, Budgets & alerts). The Natural Language service is billed per
  1,000 characters analysed, with a free monthly allowance; check Google's current pricing
  page, as it is not repeated here.
- **The Cloud Natural Language API** switched on for the project (step 3).
- **A Gmail account to send the emails from**, with an *App Password* (step 4). A school
  Google Workspace account may not allow App Passwords; if not, use a dedicated Gmail
  address (for example one made just for this site).
- **A computer with Node.js 22** and the Firebase tools (step 1).
- **Your Firestore location.** The code assumes `asia-south1` (Mumbai), which is what was
  suggested when the database was created. Check it: Firebase console, Firestore Database,
  Data tab, the location is shown at the top. If it is different, edit `FUNCTION_REGION` near
  the top of `functions/src/index.js` to match **before** deploying, or the deploy fails.

## Steps

1. **Install the tools** (once). In a terminal:
   ```
   npm install -g firebase-tools
   firebase login
   ```
2. **Get the code and install what it needs.** From a copy of this repository:
   ```
   cd functions
   npm install
   npm test        # should say "pass 24" and "fail 0"
   cd ..
   ```
3. **Switch on the Natural Language API.** Google Cloud console, "APIs & Services", "Library",
   search "Cloud Natural Language API", **Enable** (for the project `comments-for-connect`).
   Also upgrade the project to the Blaze plan if you have not (Firebase console, bottom left).
4. **Set the two email secrets.** Create an App Password for the sending Gmail account
   (myaccount.google.com/apppasswords; the account needs 2-Step Verification on). Then:
   ```
   firebase functions:secrets:set GMAIL_USER
   firebase functions:secrets:set GMAIL_APP_PASSWORD
   ```
   Paste the full Gmail address, then the 16-character App Password. Never use the account's
   real password, and do not write either value into any file.
5. **Deploy the function and the rules together.** From the repository root:
   ```
   firebase deploy --only functions,firestore:rules
   ```
   The first time, it may ask to enable several Google services (say yes) and can take
   several minutes. If it fails with a permissions message mentioning Eventarc or Pub/Sub,
   wait five minutes and run the same command again; this is a known first-deploy delay.
   (Deploying the rules this way replaces pasting them into the console by hand; the file is
   `docs/firestore.rules`.)
6. **Test before turning it on for everyone** (next section).
7. **Turn it on.** In `_config.yml` change `comments-auto-moderation: false` to `true`. This
   only changes what the page says and stops it sending its own moderation email (the
   function emails you instead). **Do not set it to true before step 5**, or comments would
   wait with nobody told.

## Test it

Use two accounts: one outside account (a personal Gmail) and, if you have one, a school
account. With the setting still `false`, the function already runs on every new comment, so
you can test without changing what visitors see.

- Post an ordinary comment from the outside account on any post. Within about 10 seconds it
  should appear, and you should get an "AUTO-APPROVED" email.
- Post one with a link in it. It should **not** appear for others, and you should get a
  "HELD FOR YOUR REVIEW (it contains a web link ...)" email.
- Post something plainly rude. It should show the author "Not published" with a gentle note,
  and you should get an "AUTO-REJECTED" email.
- Open `review.html`: the rejected one is under "Automatically rejected", the link one under
  "Waiting". Try **Approve anyway** and **Confirm reject**.
- From a school account, post a comment: it should appear at once, with no email to you.
- If something is wrong, `firebase functions:log` shows what the function did.

## Day to day

- Each decision arrives as an email with **Review or reverse this decision**. That opens
  `approve.html` for that comment, which can approve it, reject it, or take a live comment
  down.
- `review.html` lists what needs a person: comments waiting (held, or not checked), and
  comments the check rejected. Clear it when convenient.
- Commenters who ticked "Email me" get "your comment is live", "not published", and reply
  notices from the function. (The EmailJS template in `comments-setup.md` is only used when
  *you* decide something by hand.)

## What it does not do

- It does not limit how often one person can comment on the server. The page limits
  frequency, but a determined person could bypass the page. The function is capped at 5
  copies running at once, and Google Cloud lets you set budget alerts, but if someone floods
  the site you would see a burst of emails. Gmail also limits how many emails one account can
  send in a day.
- It does not understand context, sarcasm, or every language equally. Expect occasional
  wrong calls in both directions; that is what the reverse buttons and the emails are for.
- It never deletes anything. Rejected comments stay in the database, hidden.

## Changing things later

| To change | Edit |
|---|---|
| How strict it is | `RISK_REJECT_THRESHOLD` in `functions/src/index.js` (0.5 now; lower rejects more). Redeploy the function. |
| Which topics are held for you | `HOLD_CATEGORIES` in the same file. |
| Remove the web-link hold | Delete the `LINK_RE` check in the same file. Redeploy. |
| The moderator or school address | `MODERATOR_EMAIL` in the function, `isModerator()` and `isSchoolAccount()` in the rules, `comments-moderator-email` and `comments-auto-approve-domain` in `_config.yml`. |
| Switch screening off | Set `comments-auto-moderation: false` in `_config.yml`. To stop the function too: `firebase functions:delete moderateNewComment --region asia-south1`. |

## Troubleshooting

| What you see | Likely reason |
|---|---|
| Deploy fails mentioning the "region" or "location" | `FUNCTION_REGION` does not match your Firestore location (see "What you need"). |
| Deploy says billing is required | The project is not on the Blaze plan yet. |
| Deploy fails on Node 20 | The `functions/package.json` must say `"node": "22"`. Cloud Functions stopped accepting Node 20 on 2026-10-30. |
| Comments sit unpublished and no email arrives | The function is not deployed (or the secrets are wrong) but `comments-auto-moderation` is `true`. Set it back to `false`, then check `firebase functions:log`. |
| You get "COULD NOT AUTO-SCREEN" emails | The Natural Language API is not enabled, or it timed out. The comment is safely unpublished. See the error detail in the email. |
| No emails at all, but comments are decided | The Gmail App Password is wrong, expired, or blocked. Re-run step 4, then redeploy. |
| School-account comments are not instant | The rules were not published (step 5), or `comments-auto-approve-domain` differs from the rules. They then wait and are screened like anyone else. |
| An outside commenter asks where Edit went | By design; they can delete the comment and post a new one. |

## How this differs from the files first supplied

For transparency, these were changed when the supplied files were added to the site:

- Only harm categories now count towards rejection (the original took the highest of all 16,
  which would have rejected ordinary comments about health, faith or finance).
- Safety topics hold a comment for you instead of ignoring or rejecting it; web links hold it too.
- Node 22 instead of Node 20; an explicit region; at most 5 copies at once.
- The links in emails point to `connect.sahyadrischool.org`, not `sahyadrischool.org`.
- The supplied `moderator-review.html` and the `reverseDecision` function are not used. Their
  job is done by `review.html` and `approve.html`, which write the decision directly (the rules
  already let the moderator do that), so there is nothing extra to deploy or keep in step.
- The rules were corrected: `likes` is a map, so the "is list" check would have broken likes
  and reactions; deleting a comment blanks its text, which the supplied rule would have
  refused; and `lower()` does exist in Firestore rules.
