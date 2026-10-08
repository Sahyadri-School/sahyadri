# Handover guide for Sahyadri Connect

For the next group of students and staff who look after this site. It explains **where everything lives, what runs by itself, what to do when something breaks, and what to do each school year.** It deliberately contains no passwords or private details (this repository is public). Fill in the private checklist (who owns each account, backup owners, renewal dates) separately and keep it somewhere only the team can see, such as a school shared drive.

Written 8 October 2026. If something here no longer matches reality, fix this file.

Related guides: [`CMS-GUIDE.md`](CMS-GUIDE.md) (adding content, step by step), [`CONTENT-GUIDE.md`](CONTENT-GUIDE.md) (what each field means), [`README.md`](README.md) (technical detail).

## 1. How the site works, in one minute

1. Editors write content in **Pages CMS** (`app.pagescms.org`, signed in with GitHub).
2. Every save is stored as a change (a "commit") in the **GitHub repository** `Sahyadri-School/sahyadri`, on the `master` branch.
3. Each change starts a **build** in GitHub Actions (about a minute). If it succeeds, the result is published by **GitHub Pages** at `connect.sahyadrischool.org`. If it fails, **the live site simply stays on the previous version.**
4. Photos, thumbnails and PDFs are not stored in the repository; they live in **Google Drive** and are shown by their file ID.
5. Reader comments are stored in **Firebase**; the moderator is emailed through **EmailJS** and approves from a link in that email.

The CMS only covers *content*. Changes to how the site looks or works (CSS, HTML, templates) are changes to files in the repository and go live the moment they reach `master`, so test them first (see section 7).

## 2. Where everything lives

| What | What it does for the site | Where it is set up | Who needs access |
|---|---|---|---|
| GitHub repository | All content, code and history; deploys from here | `github.com/Sahyadri-School/sahyadri` → Settings → Collaborators | At least two named admins |
| GitHub Pages | Hosts the site; renews the HTTPS certificate by itself | Repo → Settings → Pages; the custom domain is the `CNAME` file | Repo admins |
| Pages CMS | The editing screens | `app.pagescms.org`; its settings are in `.pages.yml`; each editor needs **write** access to the repository | Every editor, with their own GitHub account |
| Domain and DNS | Points `connect.sahyadrischool.org` at GitHub Pages | **Not in this repository.** It is a subdomain of the school's main domain, managed by whoever runs the school's DNS (the site appears to be served through Cloudflare; confirm this) | The school's domain/DNS administrator |
| Firebase project `comments-for-connect` | Stores comments; Google sign-in; the comment **security rules** | `console.firebase.google.com` | At least two people |
| EmailJS | Emails the moderator when a comment arrives | `emailjs.com`; its IDs and public key are in `_config.yml` (public by design) | Owner of the moderator mailbox |
| Moderator mailbox | Receives notifications; its Google account is the one allowed to approve comments | `comments-moderator-email` in `_config.yml` **and** typed into the Firebase security rules. If it ever changes, change both | Two or more people |
| Google Drive | Every photo thumbnail and PDF. Files must be shared "Anyone with the link can view" | The Drive folders the team uploads to | The folder owner, plus a backup owner |
| Google Analytics 4 | Visitor statistics | The measurement ID is typed into `_includes/analytics.html`. The repo does not say who owns the property: find out and record it | Whoever owns the property |
| Third-party libraries | Bootstrap, jQuery, Popper, Font Awesome and Google Fonts load from other websites; there is nothing to configure, but if one of them disappears the styling can break | `_includes/head.html`, `_includes/footer-scripts.html` | n/a |

## 3. Accounts and safety rules

- Have **at least two people with admin access** to GitHub, Firebase, the domain/DNS and the moderator mailbox. One person leaving must never lock the school out.
- Turn on **two-factor sign-in** on every account in the table above, especially any account that several people share. Write down (in the private checklist) where its recovery codes or recovery email are.
- **This repository is public.** Never put a password, token or private information in any file, commit message or issue. (Firebase's and EmailJS's "public" keys in `_config.yml` are meant to be public; the rules in Firebase are what protect the data.)
- The maintenance **bypass key** in `_config.yml` is visible to anyone who reads the file. It only lets someone preview the site while maintenance mode is on, but do not reuse it anywhere else.
- A **personal access token** (given to a script or an AI assistant so it can change the repository) is as powerful as a password. Make it short-lived and **delete it the moment the job is done**: GitHub → Settings → Developer settings → Personal access tokens.
- Once a year, remove anyone who has left from GitHub, Firebase, the Drive folders and any other service.

## 4. What runs by itself

| What | When | What you will see |
|---|---|---|
| Build and publish | Every time anything is saved | The change is live within about two minutes. The build also checks internal links, images and scripts, and a failing check stops the publish |
| **Update CMS Activity Log** | Daily, scheduled for 03:00 UTC (08:30 IST) | A plain-text list of recent CMS edits in the CMS sidebar |
| **Update Commit Status** | Daily, scheduled for 18:30 UTC (midnight IST) | A list of recent builds and whether each went live, in the CMS sidebar |
| **External Link Check** | Mondays, 06:00 UTC (11:30 IST) | Checks links to *other* websites. If it finds trouble it opens (or reopens) a GitHub issue called "External Link Check". When everything is clean it stays quiet, or closes the issue if one was open |

Notes:
- The two daily pages can also be refreshed by hand with the buttons on the CMS **Actions** page, which is also where a run of the link check can be started.
- GitHub often starts scheduled jobs **hours late**. That is normal; the page itself shows when it was really updated.
- A link-check report is **not always a real problem.** Other websites sometimes refuse automated visits. Open the link in your browser first; if it works, close the issue and move on.

## 5. When something goes wrong

| What you see | What to check |
|---|---|
| "I saved, but nothing changed" | Wait two minutes. Then look at the CMS sidebar → **Commit Status**, or the repository's **Actions** tab. If the newest build failed, the live site is still the old version; the failing change names the file. The usual cause is a typo in the top part of a post (between the `---` lines) or stray `{{` / `{%` characters in the text |
| The site shows the maintenance page | CMS → **Site status** → switch maintenance off |
| Images or thumbnails are missing | The Drive file ID is wrong, or the file is not shared "Anyone with the link can view" |
| Comments will not post, or Google sign-in fails | Firebase console: that sign-in is enabled and `connect.sahyadrischool.org` is an authorised domain, and that the **security rules** are published |
| No moderator emails arrive | Check the spam folder, then the EmailJS dashboard (account, sending quota) |
| Pages CMS says you cannot edit or sees no repository | That person's GitHub account needs write access to the repository; also try signing out and in |
| A browser warning about the certificate, or the whole site is down | `githubstatus.com`, then repo Settings → Pages (custom domain, HTTPS), then DNS with the domain administrator |
| An "External Link Check" issue appears | See section 4: open the links in a browser before worrying |

If you are stuck, do not guess-edit files. Ask the person who manages the repository.

## 6. Each school year (do this in June)

- [ ] **Krishnamurti / Weekly Excerpts page:** add the new year's tab *before* adding that year's entries. It is a one-line edit in `kfi.html`; follow "Adding a new academic year tab" in `CONTENT-GUIDE.md`. (Newsletter, Activities, Videos and Photos build their year tabs from the dates by themselves; just check the new year's first entry appears.)
- [ ] **Profiles:** each profile carries an `academic-year` and a class label of the exact form `Student (Class N)`. Decide how the new year's profiles will be handled (see "Adding a Profile" in `CMS-GUIDE.md`) so the Profiles page groups people correctly.
- [ ] **Access review:** remove people who have left; add the new committee; confirm two admins everywhere (section 3).
- [ ] **Renewal dates:** check the domain and any paid plan in the private checklist.
- [ ] **Update the private checklist** and this file, then hand the new committee this guide plus the two guides listed at the top.

## 7. Changing how the site looks or works

Editing posts and photos in the CMS is routine. Changing CSS, HTML or templates is different:

- A change that **fails to build** is harmless to visitors (the old site stays up). A change that **builds fine but looks wrong goes live immediately.**
- Before publishing a design change, look at it first: build the site on a computer (`README.md` → "Local development") or use a separate branch and pull request so someone else can look before it merges into `master`.
- Do not write `{%` or `{{` inside Liquid comments or in free text of a template; the template engine reads them even there, and one such slip once stopped the build.
- Keep this guide and the README up to date whenever something about the set-up changes.

## 8. Small known issues (as of October 2026)

- On the Geet Gunjan page (`geeth-gunjan.md`) the two cards share one thumbnail image; each needs its own Drive file ID.
- The weekly link check can report links to the school's main website that are actually fine (the other site answers automated visits with an error).
