# Content Guide: Adding to Sahyadri Connect

Step-by-step instructions for adding each type of content. For the technical/developer overview of the site, see `README.md`.

**General rule for every Google Drive image or PDF referenced below:** the file must be shared as "Anyone with the link can view," and the ID you need is the long string in the sharing URL:

```
https://drive.google.com/file/d/  1j2nUEqjoW5XM_AtTaKuq_6v11D8DGyak  /view
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                    this is the file ID
```

---

## Newsletter post

**File:** add a new file to `_posts/`, named `YYYY-MM-DD-a-short-slug.md` (the date must match the date the post is set to; Jekyll uses the filename to derive it).

```yaml
---
layout: post
title: "ASSEMBLY BY VEERARAGHAV SIR"
date: 2026-09-04
subtitle: "Bhagyashree Patil (Teacher)"
category: "September 2026"
image: ""
---

Article text in Markdown goes here.
```

- **`subtitle`** is the byline. It's split into first/last word and checked against `_profiles/` filenames to auto-link to that person's profile page — if there's no match, it links to a generic "profile not set up yet" page instead of breaking. A middle name, initial, or hyphenated surname will usually not match automatically; add `profile-link: "https://..."` to point it at the right page directly.
- **`category`** groups the post under a month heading on the Newsletter page (`/posts/`) — use `"Month YYYY"`, matching the existing convention.
- **`image`** (optional) is a Google Drive file ID for the post's thumbnail. There's also `image2`–`image5` for a small gallery, and `pinned: true` to pin the post above others in its category.
- Two authors: add `subtitle2` (and `profile-link2` if needed) the same way.
- **`tags`** (optional) is a list, e.g. `tags: [sports, workshop]`. It shows as a "Tags:" line on the article and appears grouped on the Tag index page (`/tags/`) — only for Newsletter posts, though; this is a Jekyll limitation (`site.tags` only reads `_posts`), so adding `tags` to an Activity write-up won't show up there. There's no fixed list of allowed tags — reuse an existing one where it fits (check `/tags/` for what's already in use) rather than inventing near-duplicates.

Nothing else needs updating — the Newsletter page automatically groups posts by academic year and category from what's already in `_posts/`.

---

## Activity

**File:** add a new file to `_activities/`, same filename convention as posts.

```yaml
---
layout: post
title: "Digital Safety Workshop"
date: 2025-09-22
subtitle: "Sayantan Sen (Founder, Digital Safety India)"
category: "Digital Safety Workshop"
image: ""
---
```

Same rules as a Newsletter post (byline auto-linking, `image`, `pinned`) — activities and posts share the same layout and page logic, just live in a separate collection and separate listing page (`/activities/`).

---

## Profile

**File:** add a new file to `_profiles/`, named `first-last.md` — lowercase, hyphenated, matching what a post's byline auto-link would generate (e.g. "Aadya Tyagi" → `aadya-tyagi.md`).

```yaml
---
layout: profile
title: "Aadya Tyagi"
subtitle: "Student (Class 12)"
date: 2026-06-29
academic-year: "2026-27"
profile-image: ""
---

Bio text in Markdown.
```

- **`subtitle`** must read `"Student (Class N)"` (any class 6–12) or a role like `"Teacher"` or `"Pre-School"` — the Profiles directory page (`/profiles/`) uses this text to sort and group entries. Anything else will still show, just without a sensible sort position.
- **`profile-image`** is optional; without one, a default placeholder photo is used.
- The profile page automatically builds an "Articles by {name}" list at the bottom, pulling in every post/activity whose byline matches this person — nothing to add here for that to work, as long as the filename matches the byline the way posts already expect (see the Newsletter post section above).

---

## Photos album

**Easiest way:** use Pages CMS (see `CMS-GUIDE.md`) — the Photos collection there gives a proper "Add entry" form, identical to adding a Newsletter post.

**By hand:** add a new file to `_photos/`, named `YYYY-MM-DD-a-short-slug.md` (matching the Newsletter post convention):

```yaml
---
title: "Event Name"
drive_id: "FILE_ID_HERE"
album_link: "GOOGLE_PHOTOS_LINK"
date: 2026-08-31
date_display: "31st August 2026"
---
```

- `drive_id` is the Google Drive file ID of the thumbnail (share settings as above).
- `album_link` is the actual Google Photos album link (shared separately, viewable by anyone with the link) — this is what visitors land on when they click.
- `date` is only used to sort albums newest-first — it's never shown on the site.
- `date_display` is the exact text shown under the title. For a multi-day event, write it as a range: `"31st August – 1st September 2026"`.
- The filename doesn't need to be exact — `photos.html` sorts every entry by `date` automatically at build time regardless of file naming.

---

## Video

**Easiest way:** use Pages CMS (see `CMS-GUIDE.md`) — the Videos collection there gives a proper "Add entry" form, identical to adding a Newsletter post.

**By hand:** add a new file to `_videos/`, named `YYYY-MM-DD-a-short-slug.md`:

```yaml
---
title: "Event Name"
youtube_id: "YOUTUBE_VIDEO_ID"
date: 2026-09-04
---
```

- `youtube_id` is the 11-character ID from the video's URL (`youtube.com/watch?v=`**`THIS_PART`**).
- `videos.html` generates the "DDth Month YYYY" caption automatically from `date` — no need to write it out yourself.
- The filename doesn't need to be exact — sorted newest-first automatically at build time regardless of file naming.

---

## Krishnamurti / Weekly Excerpts (`kfi.html`)

**Easiest way:** use Pages CMS (see `CMS-GUIDE.md`) — the KFI collection there gives a proper "Add entry" form, identical to adding a Newsletter post, including for entries with more than one link.

**By hand:** add a new file to `_kfi/`, named `YYYY-MM-DD.md` (just the date — if two excerpts ever land on the same date, disambiguate manually, e.g. `2025-08-22.md` and `2025-08-22-2.md`):

```yaml
---
year: "2025"
date: 2026-01-15
youtube_id: "YOUTUBE_VIDEO_ID"   # omit this line entirely for a document-only entry
links:
- text: "Excerpt Title"
  url: "https://www.youtube.com/watch?v=YOUTUBE_VIDEO_ID"
---
```

- `year` must exactly match one of the tabs already defined near the top of `kfi.html` (the `year_blocks` Liquid variable) — unlike Videos/Photos, this is **not** computed automatically from the date.
- `youtube_id` is only for entries with an embedded video. Leave it out entirely for a document-only entry (e.g. a linked PDF transcript with no video).
- `links` is a list — most entries have just one (the excerpt's own title/link), but some entries link a video's related document or a separate playlist as a second item.
- `date` builds the "Published on" caption automatically and sorts entries newest-first within their year.
- The filename doesn't need to be exact — sorted automatically at build time regardless of file naming.

### Adding a new academic year tab

This part still needs a manual edit, near the top of `kfi.html`:

```liquid
{% assign year_blocks = "2025" | split: "|" %}
{% assign default_active_year = "2025" %}
```

To add 2026 as a new tab, change the first line to `"2025|2026"` and update `default_active_year` to `"2026"` if the new year should be the one shown by default.

---

## Ninad / Geet Gunjan (PDF archives)

**Files:** `ninad.md` or `geeth-gunjan.md`.

```liquid
<figure class="ninad-card">
  {% include pdf.html 
     thumbnail_path="/assets/Ninads/YEAR.png" 
     pdf_path="https://drive.google.com/uc?export=download&id=FILE_ID" 
     only_thumbnail=true %} 
  <figcaption class="ninad-caption-banner">Ninad YYYY-YY</figcaption>
</figure>
```

- `thumbnail_path` is a **local** image (upload a cover-page screenshot to `assets/Ninads/` or `assets/GeethGunjan/` first, then reference it here — this is the one field in this whole guide that isn't a Google Drive ID).
- `pdf_path` is a direct-download Drive link built from the file ID: `https://drive.google.com/uc?export=download&id=FILE_ID`.
- `geeth-gunjan.md` currently has two cards sharing the same thumbnail image by mistake (see `README.md`'s "Known gaps" section) — if you're fixing that, this is the pattern to follow for the corrected thumbnail.

---

## After adding content

Nothing needs to be built or triggered manually — pushing to `master` automatically builds and deploys the site (see `README.md`'s "Deployment" section). Check the **Actions** tab on GitHub after pushing to confirm the build succeeded before assuming the change is live.
