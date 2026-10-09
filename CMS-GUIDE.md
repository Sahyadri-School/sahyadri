# Using Pages CMS to Add Content

This is for anyone adding a Newsletter post, Activity write-up, or Profile who doesn't want to touch GitHub directly. If you're comfortable editing files on GitHub, you don't need this — see `CONTENT-GUIDE.md` instead.

## Before you start

Someone with admin access to the repository needs to have:
1. Installed the Pages CMS GitHub App on this repository (at [app.pagescms.org](https://app.pagescms.org))
2. Added you as a collaborator on the repository, so you have your own access

If you don't have a GitHub account yet, you'll need to create one first (free, at github.com) — this is what identifies you as the author of each change.

## Logging in

1. Go to [app.pagescms.org](https://app.pagescms.org)
2. Sign in with your GitHub account
3. Select the **sahyadri** repository
4. You'll see six sections in the sidebar: **Newsletter Posts**, **Activities**, **Profiles**, **Videos**, **Photos**, and **Krishnamurti / Weekly Excerpts** — plus a seventh, **Site status**, which only holds the maintenance switch (see below)

## Adding a Newsletter post or Activity

1. Click **Newsletter Posts** (or **Activities**) in the sidebar
2. Click **Add entry** (usually top right)
3. Fill in the fields:

| Field | What to put |
|---|---|
| Title | The article's headline |
| Date | The actual date this happened/was posted |
| Byline (author) | Full name and role, e.g. "Aadya Tyagi (Class 12)" or "Swati Gautam (Teacher)" |
| Category | The month this belongs under, e.g. "September 2026" (Posts only — must be exactly this format) |
| Thumbnail image | See "Adding images" below |
| Tags | Pick from the list — don't type a new one |
| Article text | The body of the article |

4. Click **Save**

That's it — the site rebuilds automatically within a couple of minutes.

### A few things worth knowing

- **The byline auto-links to a profile.** If you write "Aadya Tyagi (Class 12)" and a profile for Aadya Tyagi already exists, her name becomes a clickable link automatically — you don't need to do anything extra. This mostly comes up with teacher bylines, whose name or title (a middle name, an honorific) more often won't auto-match a profile — if that happens, use the "Profile link override" field to paste the profile's URL directly instead.
- **Two authors?** Use the second byline field, not a comma in the first one.
- **"Pinned"** puts this post above the others in its category on the Newsletter page — use this sparingly, for something you specifically want to stay at the top.

## Adding images

Every image on this site is a **Google Drive file**, not something you upload here. To add one:

1. Upload the photo to Google Drive (if it isn't there already)
2. Right-click the file → **Share** → make sure it's set to **"Anyone with the link can view"**
3. Copy the sharing link — it looks like:
   ```
   https://drive.google.com/file/d/1j2nUEqjoW5XM_AtTaKuq_6v11D8DGyak/view
   ```
4. Copy just the long ID part in the middle (`1j2nUEqjoW5XM_AtTaKuq_6v11D8DGyak` in the example above) — **not** the whole link
5. Paste just that ID into the image field

If a photo doesn't show up on the live site after publishing, the most common reason is the sharing setting — double check it says "Anyone with the link," not "Restricted."

## Adding a Profile

1. Click **Profiles** in the sidebar → **Add entry**
2. **Full name** — write it exactly as it should appear in article bylines (e.g. "Aadya Tyagi"). This is what makes the auto-linking described above work.
3. **Role** — must be exactly one of: `Student (Class 6)` through `Student (Class 12)`, `Teacher`, or `Pre-School`. The form will warn you if this doesn't match.
4. **Academic year** — format `YYYY-YY`, e.g. `2026-27`
5. **Profile photo** — same Google Drive ID process as above; leave it blank if there isn't one yet
6. **Bio** — a short write-up about the person
7. Click **Save**

## Adding a Video or Photo album

Click **Videos** or **Photos** in the sidebar → **Add entry**, same as above.

- **Videos**: needs a title, the YouTube video ID (the part after `v=` in the video's URL), and a date. The caption date is generated automatically — you don't need to type it out.
- **Photos**: needs a title, the thumbnail's Google Drive file ID (same process as any other image field — see "Adding images" above), the actual Google Photos album link, a date (used only for sorting), and the exact date text to display. For an event spanning several days, write that last one as a range yourself, e.g. "31st August – 1st September 2026" — this is the one field the form won't generate for you.

## Adding a Krishnamurti / Weekly Excerpt

Click **Krishnamurti / Weekly Excerpts** in the sidebar → **Add entry**.

- **Year** is the start year of the academic year this excerpt belongs to, e.g. "2025" for the 2025–26 year. Its tab appears on the live page automatically — the very first entry for a new academic year creates that year's tab by itself, no separate step needed. Use "archive" instead for older material that doesn't belong to one specific academic year; that tab always appears last.
- **YouTube video ID** — leave blank for a document-only entry (e.g. just a linked PDF), no video needed.
- **Links** — usually just one (the excerpt's own title and link), but you can add a second if this excerpt has, say, both a video and a separate related document or playlist. Leave a link's URL blank if you just want to show its text as a plain label with nothing clickable.
- **Date** builds the "Published on" text automatically and sorts the entry into the right place.

## Turning maintenance mode on or off

Use this when the site needs to be closed to visitors for a while, e.g. during big changes.

1. Click **Site status** in the sidebar
2. Switch **Maintenance mode** on (site closes) or off (site reopens)
3. Click **Save**

The change goes live after the site rebuilds, usually 1–2 minutes. While it's on, every visitor sees a maintenance page instead of the site, so switch it on deliberately and remember to switch it off afterwards. This is the only thing on that screen; nothing else about the site changes.

## If a collection looks broken or asks to "create a file" that shouldn't exist

The CMS occasionally holds onto an old cached copy of its own configuration in your browser, especially if it's been a while since you last used it. If a collection shows an unexpected error (e.g. offering to create a file at a path that doesn't match how that content actually works, or a section that used to work suddenly doesn't), the most likely fix is a hard refresh of the page — or closing the tab and opening [app.pagescms.org](https://app.pagescms.org) fresh. That forces it to re-fetch the current setup instead of an outdated one.

If a hard refresh doesn't clear it, flag it rather than trying to work around it — an outdated config can occasionally cause a save to go to the wrong place.

## If something looks wrong after publishing

Changes usually appear on the live site within a couple of minutes. If a page looks broken or something didn't save right, don't try to fix it by guessing — flag it to whoever manages the site's GitHub repository.
