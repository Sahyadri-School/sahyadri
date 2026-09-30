# Comments: review queue, trusted people, and emails to commenters

This guide covers the newer parts of the comment system and the two things that
must be done **outside this repository** (in the Firebase and EmailJS websites)
before they switch on. Nothing here can break commenting: until a step is done,
the feature that needs it simply stays off and everything works as before.

## What's new

| Feature | Needs |
|---|---|
| **Review queue** (`review.html`): every comment and reply waiting for approval, in one live list | Nothing extra. Works straight away. |
| **Posting limits**: a short wait between posts, and a cap on how many comments one person can have waiting | Nothing extra. Works straight away. |
| **Trusted people**: their comments and replies appear immediately | Step 1 (Firebase rules) |
| **A note when you reject a comment**, shown to the person who wrote it | Step 1 |
| **"Approve & always trust"** button, and the commenter's email shown to you | Step 1 |
| **Emails to commenters**: "your comment is live", "not published", "someone replied" | Steps 1 and 2 |

## Step 1: publish the updated Firebase rules

The rules decide who is allowed to read and write comments. They live in Firebase,
not in this repository, so only someone with access to the Firebase project can
change them.

1. Open the Firebase console (console.firebase.google.com) and choose the project
   **comments-for-connect**.
2. In the left menu choose **Firestore Database**, then the **Rules** tab.
3. Select everything in the editor and delete it.
4. Open `docs/firestore.rules` in this repository, copy the whole file, and paste it in.
5. Press **Publish**.

That's all. To check it worked, post a test comment from a normal (non-moderator)
account, then open the review queue: the comment should be listed, with the
commenter's email next to their name.

If you ever change the moderator's address in `_config.yml`
(`comments-moderator-email`), change the address inside `isModerator()` in the
rules as well, and publish again.

### What changed in the rules

The top of `docs/firestore.rules` lists the five changes. In short: two new
collections (`trusted`, `commentPrivate`), the moderator may also record a rejection
note, trusted people may create already-approved comments, and a small fix so a
comment of exactly 2000 characters is accepted.

## Step 2 (optional): emails to commenters

This uses a **second** EmailJS template, in the same EmailJS account and service that
already sends you the moderation emails. Skip this step if you don't want the site to
email commenters; everything else still works.

1. Log in to EmailJS (emailjs.com) and go to **Email Templates → Create New Template**.
2. **Subject:** `{{subject}}`
3. **To email:** `{{to_email}}`
4. **From name:** `Sahyadri Connect`
5. **Reply to:** your school address (for example `archives@sahyadrischool.org`), so
   any reply comes to you.
6. In the content editor choose the code (HTML) view and paste:

```html
<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #3E3830;">
  <p>Hi {{to_name}},</p>
  <p>{{message}}</p>
  <p style="margin: 24px 0;">
    <a href="{{page_url}}"
       style="background: #668571; color: #ffffff; text-decoration: none;
              padding: 10px 22px; border-radius: 20px; display: inline-block;">
      {{button_label}}
    </a>
  </p>
  <p style="font-size: 12px; color: #767268;">
    You're getting this because you asked to be emailed about your comments on
    Sahyadri Connect. To stop, untick &ldquo;Email me&rdquo; the next time you comment.
  </p>
</div>
```

7. Save, and copy the **Template ID** (it looks like `template_abc1234`).
8. In `_config.yml`, set `emailjs-notify-template-id: "template_abc1234"` and publish the
   site.

The "Email me when my comment is reviewed or someone replies" tick box then appears
under the comment box. (It is ticked by default and remembers each person's choice.)

**Things to know**
- The emails are sent from *your* browser at the moment you approve or reject, using
  EmailJS. Each one counts toward EmailJS's monthly limit (the free plan is small, so
  check yours). The moderation emails you already receive count towards the same limit.
- Someone is emailed about a reply only when *you* approve the reply. A reply from a
  trusted person is published straight away with no approval step, so it doesn't
  trigger that email.
- Only people who ticked the box are ever emailed.

## Using the review queue

*Optional:* the moderation email you already receive can also link straight to the queue.
The site now sends a `{{review_link}}` value along with the message, so in that EmailJS
template you can add, for example,
`<a href="{{review_link}}">See everything waiting for review</a>`.

- Bookmark `connect.sahyadrischool.org/review.html` and sign in with the moderator account.
- The link in each notification email still works too; it opens the single comment.
- **Approve** publishes it. **Approve & always trust** also adds that person to the
  trusted list, so their future comments and replies appear immediately. **Reject…**
  lets you type an optional note; the person sees it in place of their comment, and is
  emailed it if Step 2 is done.
- **Trusted people** (lower on the same page): add someone by email (for example a
  teacher, before they've commented), or remove someone. A removed person's next
  comments wait for review again.
- Trust people you know. A trusted account's comments go live with no review at all.

## Posting limits

Set in `_config.yml`:

- `comments-cooldown-seconds: 45`: the shortest wait between one person's posts.
- `comments-max-pending: 3`: how many of one person's comments can be waiting for review
  at once (trusted people are exempt).

Set either to `0` to turn it off. **What these do and don't do:** they are checked by the
page, so they stop accidents, double-clicks and casual flooding. Someone who deliberately
bypasses the page (calling Firebase directly) is not stopped by them. Two things worth
doing in the EmailJS dashboard to limit the damage of that: restrict the **allowed
domains** to `connect.sahyadrischool.org`, and keep an eye on the monthly email count.
Enforcing limits fully on the server needs Firebase Cloud Functions, which require a paid
Firebase plan, so it hasn't been set up.

## What is stored, and privacy

- `commentPrivate` holds, for each comment, the commenter's Google email address and
  whether they asked to be emailed. Only the moderator account can read it, and it is
  never shown on the site. The moderation email you already receive contains the same
  address.
- `trusted` holds the email addresses (and optional names) of trusted people. Only the
  moderator can read or change the list; each person can check only their own entry.
- To remove someone's stored email, delete their document in the Firebase console
  (Firestore Database → Data → `commentPrivate`).

## If something doesn't work

| What you see | Likely reason |
|---|---|
| Rejecting says the note couldn't be shown to the commenter | Step 1 (rules) isn't published yet. |
| "Trusted people" says it needs the updated rules | Step 1 isn't published yet. |
| No "Approve & always trust" button, and no email next to the name | That comment has no private record: it was posted before Step 1, or Step 1 isn't done. Add the person under **Trusted people** by typing their email. |
| The "email me" tick box doesn't appear | `emailjs-notify-template-id` in `_config.yml` is blank (Step 2), or the site hasn't rebuilt yet. |
| A trusted person's comment still waits for review | Their email in the list doesn't exactly match their Google account's email, or they have not signed out and back in since being added. |
| A commenter says they can't post | They may have hit the wait between posts or the waiting-comments cap; the message under the box tells them which. |
