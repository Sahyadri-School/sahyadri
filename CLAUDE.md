# CLAUDE.md

Notes for Claude Code (or any assistant or new developer) working in this repository. Read this first. It records how the site is put together, how to change it safely, and the traps already hit here. **Keep it up to date:** if you learn something that would have saved an hour, add it.

## What this is

Sahyadri Connect (`connect.sahyadrischool.org`): a school's Jekyll site on GitHub Pages. Content is edited by students and staff in **Pages CMS** (configured by `.pages.yml`). Every push to `master` builds and goes live in about two minutes. **The repository is public.** The people who maintain it are mostly students who change every year, plus a teacher: explain changes in plain language and do not assume Git or Ruby knowledge.

Other documents: `README.md` (technical), `HANDOVER.md` (where everything lives, who owns what, what to do when something breaks, the yearly checklist), `CMS-GUIDE.md` and `CONTENT-GUIDE.md` (adding content).

## Ground rules

1. **`master` is live.** Make code, template and CSS changes on a branch and open a pull request; do not push them straight to `master` unless the user says so. Content edits reach `master` all day from the CMS (commits that say "via Pages CMS"), so fetch before you push and never overwrite a file someone else changed in the meantime.
2. **No secrets in the repo**, commit messages, issues or PR text. If you are given a personal access token, treat it as exposed when the task ends and tell the user to delete it (GitHub → Settings → Developer settings → Personal access tokens).
3. **Some things live outside the repo and you cannot change them:** the Firebase project and its Firestore security rules, EmailJS, DNS/Cloudflare, Google Drive files, the Analytics property. Tell the user exactly what to change there; do not guess.
4. **Ask before** switching the announcement banner or maintenance mode on or off (`_data/announcement.yml`, `_data/maintenance.yml`; they are the owners' switches), deleting content, or changing who has access. If you enable the banner to test it, do it only in your local copy.
5. **Verify, do not guess.** Several wrong diagnoses here came from reasoning about CSS or JavaScript instead of measuring it. Reproduce the problem first (real browser, the real page: computed styles, bounding boxes), fix it, then measure again. Say plainly what you could not test.
6. **Keep the documents honest:** update `README.md` / `HANDOVER.md` when behaviour changes, and update the comment header of any file you change.

## Build, test, check

- **Local preview:** `bundle install`, then `bundle exec jekyll serve` and open `http://localhost:4000` (CI uses Ruby 3.2).
- **CI** (`.github/workflows/ci.yml`, every push to `master`): `bundle exec jekyll build` (with `JEKYLL_ENV=production`), then `check_links.rb` (html-proofer on internal links, images and scripts, using `.htmlproofer.yml`). A failure blocks the deploy and the previous site stays live. **A change that builds but looks wrong goes live immediately.**
- **Weekly:** `check_external_links.rb` with `.htmlproofer-external.yml` checks links to other websites and reports through a GitHub issue; it never blocks anything. The script only passes on the options it names (today: `disable_external`, `allow_hash_href`, `ignore_urls`, `ignore_files`, `checks`, `ignore_status_codes`, `typhoeus`, `hydra`); a new key added to the YAML is silently ignored until the script passes it on.
- **Before a pull request:** build locally; open the changed pages in light and dark mode (the dark-mode switch toggles a `dark-mode` class on `<html>`) and at phone width; for layout problems read real measurements in a headless Chromium.

## Map of the repository

- Content collections: `_posts/` (newsletter), `_activities/`, `_profiles/` (each has its own page); `_videos/`, `_photos/`, `_kfi/` have `output: false` (they only feed the list pages `videos.html`, `photos.html`, `kfi.html`).
- Hand-edited pages that are **not** in the CMS: `geeth-gunjan.md`, `ninad.md`, `index.md`, and the templates.
- `_layouts/` (`base`, `page`, `post`, `profile`, `default`), `_includes/` (nav, header, footer, `firebase-comments.html`, `announcement.html`, `analytics.html`, ...), `assets/css/custom-styles.css` (all site CSS, numbered sections), `_data/` (maintenance and announcement switches).
- `.pages.yml` defines what the CMS shows (collections, the Site status and Announcement entries, the Actions buttons). `.github/workflows/` holds the build, the weekly link check, and two generators (`cms-activity-log.md`, `commit-status.md`; written by workflows, never hand-edit them).
- Images and PDFs are **Google Drive files shown by ID** (`lh3.googleusercontent.com/d/<id>`, `drive.google.com/thumbnail?id=<id>`); they must be shared "Anyone with the link can view".

## Traps already hit (each one cost real time)

**Templates and the build**
- Liquid reads `{%` and `{{` **everywhere in a file, including inside `{% comment %}` blocks and HTML comments.** Prose containing them once broke the production build. Write "a Liquid tag" instead.
- A file at the repository root without front matter is published as a raw file. Put documents and generated files in `exclude:` in `_config.yml`. Non-HTML files that should be output (`site.webmanifest`, `maintenance-status.json`) need `layout: null` or the page layout wraps them in HTML.
- Newsletter, Activities, Videos, Photos and the Krishnamurti page all build their year tabs automatically (an academic year runs June to May) — the Krishnamurti page's tabs come from each `_kfi/` entry's own `year` field (see `kfi.html`), not from dates directly, so that field still has to be set correctly on each entry.

**CSS and behaviour**
- The theme rule near the top of `custom-styles.css` (`body, p, div { color: #404040; font-weight: 300 !important; ... }`) matches every `<div>` **directly**, so it beats any colour merely inherited from a parent. A new component must set colour and weight on its own elements (this made the banner text and the comment name unreadable in dark mode).
- `position: sticky` only moves inside its parent's box (a wrapper exactly as tall as the sticky child leaves it no room), and `overflow-x: hidden` on `html` or `body` breaks sticky; the site uses `overflow-x: clip`.
- The navbar is `position: fixed` and **changes height**: about 109px at the top of the page and 69px once scrolled 50px on screens 1200px and wider (a padding transition). Anything positioned against it has to follow. `ResizeObserver` watches the content box by default and misses padding changes, so observe with `{ box: 'border-box' }`.
- `getAttribute()` returns decoded text; putting it back through `innerHTML` re-parses it as markup. Build DOM with `createElement` / `textContent`.
- Anything stored in Firestore can be written by any signed-in visitor (the rules decide how much). Escape every value and only turn a stored URL into a link after checking its scheme (`approve.html` does this).

**Automation and the CMS**
- `.pages.yml` is validated strictly by Pages CMS: select options are `{ value, label }` objects, and unknown keys are rejected. Buttons on the Actions page start workflows that must accept the `payload` input.
- In workflows: use `git status --porcelain` to detect changes (`git diff --quiet` ignores new, untracked files); if a push is rejected because someone else pushed, `git reset --hard` to the remote and regenerate (a rebase conflicts on the generated file); cron times are UTC and runs often start hours late; a workflow cannot be started by a commit made with the default `GITHUB_TOKEN`.
- Pushing straight to `master` while editors work: the CMS commits constantly, so a stale checkout will be behind. Re-fetch right before you push.

## Comments system (Firebase)

The widget is `_includes/firebase-comments.html`; moderation is `approve.html`, opened from an email link. The **Firestore security rules are not in this repository**; they are published in the Firebase console (project `comments-for-connect`). What the rules assume of the widget: a new comment has exactly the fields the widget writes, starts unapproved with no likes or reactions, and its `pageUrl` is on `connect.sahyadrischool.org`; likes and reactions only change the signed-in person's own entry; authors can edit their text only until it is approved, and can delete at any time; only the moderator account approves. **If you change what the widget writes, the rules must change with it, and only the user can publish them:** write the new rules out in full and explain how to test them.

## Known open items (as of October 2026)

- `geeth-gunjan.md`: the two cards share one thumbnail; each needs its own Drive file ID.
- The maintenance bypass key in `_config.yml` is public; it only lets someone preview the site during maintenance.
- Analytics: the GA4 ID is hard-coded in `_includes/analytics.html`.
