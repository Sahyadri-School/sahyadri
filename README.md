# Sahyadri Connect

A Jekyll site for Sahyadri School, built on the [Beautiful Jekyll](https://beautifuljekyll.com/) theme. Live at **https://connect.sahyadrischool.org**.

This README describes what's actually in the repo. If you're looking at an older version of this file, note that a previous draft described features (Giscus comments, a `layout: events` type, a `pages/` and `_data/` directory) that were never actually built — this version reflects the real site.

## Overview

The site hosts:

- A monthly **Newsletter** (`/posts/`) — student-written articles, grouped by academic year and month
- **Activities** (`/activities/`) — workshops and events, same tabbed-by-year format
- **Profiles** (`/profiles/`) — one page per student/teacher, listed on a searchable directory
- **Krishnamurti / Weekly Excerpts** (`/kfi/`) — embedded videos and linked documents from Krishnamurti Foundation India
- **Videos** (`/videos/`) and **Photos** (`/photos/`) — media galleries, also grouped by year
- **Ninad** (`/ninad/`) and **Geet Gunjan** (`/geeth/`) — PDF archives of school magazines
- A **Tag index** (`/tags/`) — every Newsletter post's tags, grouped and cross-linked; Activities aren't included (a Jekyll `site.tags` limitation, see below)
- A **comments system** on posts, activities, and profile pages, with two interchangeable backends (see below)

## Project structure

```
.
├── _config.yml              # All site settings — see "Configuration" below
├── _posts/                  # Newsletter articles (one file per post)
├── _activities/             # Activity/workshop write-ups
├── _profiles/                # One file per student/teacher profile
├── _videos/                   # One file per video (output: false — no
│                                individual pages, just enumerable via
│                                site.videos for videos.html to loop over)
├── _photos/                   # One file per photo album (output: false,
│                                same reasoning as _videos/)
├── _kfi/                      # One file per Krishnamurti/Weekly Excerpt
│                                entry (output: false, same reasoning as
│                                _videos/_photos)
├── _data/
│   └── maintenance.yml        # The maintenance-mode on/off switch (`enabled`),
│                                editable in the CMS as "Site status"
├── _layouts/
│   ├── base.html             # <html>/<head>/<body> shell every page extends
│   ├── page.html              # Standard content page (extends base)
│   ├── post.html               # Individual newsletter/activity article page
│   ├── profile.html            # Individual profile page
│   ├── default.html            # Used by 404.html and profiles-directory.html
│   ├── minimal.html             # From the theme; not currently used by any page
├── _includes/
│   ├── head.html, header.html, nav.html, footer.html   # Shared page chrome
│   ├── comments.html          # Router: picks Elfsight or Firebase (below)
│   ├── elfsight-comments.html # Third-party hosted comment widget
│   ├── firebase-comments.html # Custom Firebase comment widget (threads,
│   │                            likes, reactions, moderation queue)
│   ├── toc.html               # Shared table-of-contents sidebar logic
│   └── pdf.html                # Renders one PDF thumbnail card (Ninad/Geet Gunjan)
├── assets/
│   ├── css/custom-styles.css  # All site-specific CSS (the theme's own CSS
│   │                            files are untouched)
│   ├── img/                    # Local images (Newsletter/Photos galleries,
│   │                            favicons, avatar)
│   ├── Ninads/, GeethGunjan/    # PDF archives + their thumbnail images
│   └── js/                     # Theme JS (from Beautiful Jekyll, not custom)
├── index.md                  # Homepage (a short welcome blurb, no post feed)
├── posts.md                  # Newsletter listing page
├── activities.md             # Activities listing page
├── profiles.html             # Profiles directory (dynamic year/category UI)
├── profiles-directory.html   # Fallback page for authors without a profile
│                                yet (permalink: /not_done_yet)
├── videos.html                 # Loops over _videos/ (site.videos)
├── photos.html                 # Loops over _photos/ (site.photos)
├── kfi.html                    # Loops over _kfi/ (site.kfi)
├── ninad.md, geeth-gunjan.md   # PDF archive pages
├── tags.html                  # Tag index, grouped by tag with a sticky
│                                TOC sidebar (same pattern as Newsletter/
│                                Activities). Only site.tags (i.e. only
│                                _posts) feeds this — Jekyll's built-in
│                                site.tags is a posts-only feature, so a
│                                tags: field added to an _activities file
│                                would silently have no effect here.
│                                Not currently in the nav bar (removed
│                                for now) — reachable via a direct link
│                                or the "Tags:" line on a tagged post.
├── comms.md                   # Static "how to reach us" page
├── maintenance.html            # Maintenance-mode landing page (see below)
├── approve.html                # Comment moderation review page (see below)
└── 404.html                    # Custom not-found page
```

## Content authoring

### Newsletter post

Add a file to `_posts/` named `YYYY-MM-DD-slug.md`:

```yaml
---
layout: post
title: "ASSEMBLY BY VEERARAGHAV SIR"
date: 2026-09-04
subtitle: "Bhagyashree Patil (Teacher)"      # Byline — auto-linked to a profile
subtitle2: ""                                # Optional co-author, same rules
profile-link: ""                             # Optional: override the auto-generated profile link
profile-link2: ""
category: "September 2026"                   # Groups posts into the newsletter's month sections
image: ""                                    # Google Drive file ID for the thumbnail (see below)
image2: "" 
image3: ""
image4: ""
image5: ""
pinned: false                                # true pins this post above its category's other posts
---

Article text in Markdown.
```

**How the byline link works:** `subtitle`/`subtitle2` is split into first and last word, lowercased and hyphenated (`"Bhagyashree Patil"` → `bhagyashree-patil`), and checked against `_profiles/` filenames. If a match exists, the name links to that profile page. If not, it links to `/not_done_yet` (served by `profiles-directory.html`) instead of a broken link. This mostly affects teacher bylines, whose name or title (a middle name, an honorific) more often won't match automatically — use `profile-link`/`profile-link2` to point at the right page directly in that case.

### Activity

Same format as a post, in `_activities/` instead:

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

Note: activities use `layout: post` — the same layout as newsletter articles — not a separate `events` layout.

### Profile

Add a file to `_profiles/` named `first-last.md` (must match the slug the byline logic above generates):

```yaml
---
layout: profile
title: "Aadya Tyagi"
subtitle: "Student (Class 12)"    # Also drives the weighting/grouping on the profiles directory page
date: 2026-06-29
academic-year: "2026-27"
profile-image: ""                  # Google Drive file ID
---

Bio text in Markdown.
```

`subtitle` should read `"Student (Class N)"` or a role like `"Teacher"` — `profiles.html`'s sorting logic looks for these substrings to group and order the directory.

Nothing else needs to be added manually to get a profile listed in its own "Articles by" section — `_layouts/profile.html` runs the byline-matching logic (above) in reverse at build time: it slugifies this profile's own name and checks every post/activity's `subtitle`/`subtitle2` (and `profile-link`/`profile-link2`, for the manual-override cases) against it, then lists whatever matches, newest first. The section doesn't render at all if nothing matches.

### Images (Google Drive)

Image fields (`image`, `profile-image`, etc.) take a **Google Drive file ID**, not a URL — extract it from the sharing link:

```
https://drive.google.com/file/d/  1j2nUEqjoW5XM_AtTaKuq_6v11D8DGyak  /view
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                    this part goes in the front matter field
```

The file must be shared as "Anyone with the link can view." Pages render these via `https://lh3.googleusercontent.com/d/<id>` rather than linking to the Drive page directly.

Local images (used in the Photos/Newsletter static galleries) live under `assets/img/`.

### Ninad / Geet Gunjan PDFs

These use `_includes/pdf.html`, which expects a card wrapper with a `thumbnail_path` (a local image under `assets/`) and a `pdf_path` (an external Drive link). See `ninad.md` or `geeth-gunjan.md` for the exact pattern.

## Comments system

`_includes/comments.html` is a router: it checks `page.comments` (set via the collection defaults in `_config.yml` for posts/activities/profiles) and `site.comments-provider`, then includes one of:

- **`elfsight-comments.html`** (default) — a hosted third-party widget. Configured via `elfsight-app-id`.
- **`firebase-comments.html`** — a custom-built widget: Google sign-in, threaded replies, likes, emoji reactions, sort by newest/oldest/most-liked, edit/delete your own comment, and a moderation queue.

### Firebase comments moderation

New comments save with `approved: false` and are visible only to their author until approved. The widget uses two separate Firestore queries (a public one requiring `approved == true`, and a second scoped to the signed-in viewer's own `uid`) rather than one broad read filtered client-side, so a Firestore security rule can actually validate what each query is allowed to see.

To review and approve a pending comment: **`approve.html`** (at the repo root, `noindex`) takes a `?id=<commentId>` query param, requires signing in as the address in `comments-moderator-email`, and shows an Approve/Reject UI. If `emailjs-*` config values and `comments-moderator-email` are all set, a new comment also triggers an email (via EmailJS) with a direct link to that page.

**Important:** none of the interactive Firebase features (posting, liking, editing, deleting, approving) work until the Firestore security rules for the `comments` collection are published in the Firebase console — that's a manual step outside this repo. Don't leave Firestore in open "test mode" on a real deployment, since visitors sign in with their real Google accounts here.

## Maintenance mode

Maintenance mode is a single on/off value, `enabled`, in `_data/maintenance.yml`. When it's `true`, every page redirects to `/maintenance/`. Staff can flip it from the CMS (the **Site status** entry), or you can edit that file directly. Either way it takes effect after the site rebuilds, usually 1–2 minutes after saving. It lives in its own file rather than in `_config.yml` because a CMS save rewrites the whole file it edits, which would have stripped `_config.yml`'s explanatory comments. If that file is ever missing or empty the site simply stays open.

To preview the site while maintenance mode is on, visit:

```
https://connect.sahyadrischool.org/?bypass=<maintenance-bypass-key>
```

This unlocks browsing for the rest of that browser tab's session (via `sessionStorage`) — it resets when the tab closes. The key itself, `maintenance-bypass-key`, stays in `_config.yml`. Change it any time to invalidate old bypass links. Note this repo is public, so the key isn't a real secret; it just keeps casual visitors from stumbling onto the bypass.

`maintenance.html` itself also reverse-redirects to the homepage if someone lands on it while maintenance mode is actually off (e.g. from a stale cached page) — see its own comments for details.

`approve.html` intentionally bypasses the maintenance-mode redirect entirely, so a moderator can still approve/reject comments while the rest of the site is down.

## Configuration reference (`_config.yml`)

| Key | Purpose |
|---|---|
| `url`, `baseurl`, `title`, `author`, `description` | Basic site identity |
| `maintenance-bypass-key` | See above. (The on/off switch itself is `enabled` in `_data/maintenance.yml`, not in this file.) |
| `navbar-links` | Nav bar structure — top-level and dropdown items |
| `post_search` | Enables the year-scoped search box on the Newsletter/Activities pages |
| `page-col`, `text-col`, `link-col`, `hover-col`, `navbar-*`, `footer-*` | Color palette, consumed as CSS custom properties |
| `date_format` | Display format for post/activity dates |
| `comments-provider` | `"elfsight"` or `"firebase"` |
| `elfsight-app-id` | Elfsight widget config |
| `firebase-*` (six keys) | Firebase project config for the custom comments widget |
| `emailjs-*`, `comments-moderator-email` | Optional moderation email notifications |
| `defaults` | Per-collection layout/front-matter defaults (posts/activities get `layout: post`; profiles get `layout: profile`; everything else gets `layout: page`) |
| `collections` | Registers `posts`, `activities`, `profiles` with `output: true` (each gets individual pages) and `videos`, `photos`, `kfi` with `output: false` (enumerable via `site.videos`/`site.photos`/`site.kfi`, but no individual pages — they only ever appear as grid/list items) |

## Local development

```bash
bundle install
bundle exec jekyll serve
```

Then visit `http://localhost:4000`. Note: `jekyll-paginate` is **not** installed (see the Gemfile's own comment on version conflicts) -- relevant if a paginated post-feed page is ever built, since that plugin isn't available here.

## Deployment

Deployment runs via a GitHub Actions workflow (`.github/workflows/ci.yml`) on every push to `master` — it builds the Jekyll site and publishes it to GitHub Pages. There's no separate manual deploy step; pushing to `master` is the deploy.

## Automated checks

Two separate checks run, deliberately kept apart from each other:

- **On every push** (part of `ci.yml`, blocks the deploy if it fails): `check_links.rb` runs [html-proofer](https://github.com/gjtorikian/html-proofer) against the built site using `.htmlproofer.yml` — internal links, scripts, and images. External links are explicitly excluded here (`disable_external: true`) since external sites are flaky in CI, and a broken deploy over someone else's site having a bad moment is worse than not catching link rot instantly.
- **Weekly** (`.github/workflows/external-links.yml`, Mondays): `check_external_links.rb` runs the same tool against `.htmlproofer-external.yml` instead — the config with external links actually enabled. This never blocks a deploy. Results are reported via `report_external_links.py`, which manages a single persistent GitHub Issue titled "External Link Check": it creates/reopens/comments on that issue only when something is actually broken, and closes it with an all-clear note once things are fixed. Silent on success — no news is good news. (This requires GitHub Issues to be enabled for the repo; a repo admin can toggle this under Settings → Features if it's ever off.)

Both scripts exist because the plain `htmlproofer` CLI doesn't auto-discover a config file just because it's named `.htmlproofer.yml`/`.htmlproofer-external.yml` — confirmed by testing, not assumption. Each script loads its YAML config by hand before invoking `HTMLProofer.check_directory`.

## Design notes

- Fonts: **Amatic SC** (display headings), **Poiret One** (theme body/nav text), and **Montserrat** (post/article body text) — all loaded via Google Fonts in `_includes/head.html`.
- **Icons:** the browser-tab, iPhone home-screen and installable-app icons are all in `assets/img/` (`icon.svg` is the editable vector master; the PNG sizes and `favicon.ico` are rendered from it) and are wired up in `_includes/head.html` and `site.webmanifest`. The artwork is a redrawn, bolder version of the mountain-and-birds mark from the school logo, using only the peak at the tiny tab sizes where the full ridge is too thin to read. If the school's original high-resolution logo file becomes available, re-trace from that.
- Dark mode is a `.dark-mode` class toggled on `<body>`; most components have a corresponding `.dark-mode .component { ... }` override in `custom-styles.css` rather than CSS variables for dark-mode-specific colors.
- All page-specific CSS lives in `assets/css/custom-styles.css`, organized into numbered sections (see the file's own comments) — the theme's own CSS files (`beautifuljekyll.css`, etc.) are left untouched.
- **Sticky elements and the fixed navbar:** the site's navbar is `position: fixed`, and content elsewhere clears it with a `margin: 5rem` on `.intro-header`. Any `position: sticky` element needs a `top` value of at least that much (the site uses `90px`, navbar clearance plus a small visible gap) — a smaller value doesn't just look cramped, the element sticks to a point still partially hidden *behind* the navbar. There are two such sidebars on the site (`.toc-sidebar` for Newsletter/Activities/Tags, `.profile-toc-sidebar` for Profiles) that are separate implementations kept in sync only by hand — see the maintenance note on each in `custom-styles.css`.

## Known gaps

- **`geeth-gunjan.md`** has two PDF cards ("Original" and "English Transliterated") sharing the same thumbnail image; a comment in the file flags this as needing the correct second thumbnail's Google Drive file ID.
- Analytics is confirmed active and tracking real traffic (a Google Analytics dashboard has shown live data), but none of the repo's own tracking `_includes` (`gtag.html`, `gtm_head.html`, `google_analytics.html`, `cloudflare_analytics.html`, `matomo.html`, `analytics.html`) have a config value set in `_config.yml` to fire them — so whatever's actually tracking is set up outside this repo (plausibly at the Cloudflare/DNS level, given the site is proxied through it), not through any of these dormant hooks. `mathjax.html` remains a separate, unused theme hook.
