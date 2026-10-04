#!/usr/bin/env python3
"""
generate_cms_log.py

Builds cms-activity-log.md: a plain, readable list of the most recent content
changes made through Pages CMS, read from this repository's own commit
history. Written so a non-technical person can open it in the CMS sidebar
(it's wired up in .pages.yml as a read-only "CMS Activity Log" file entry)
and see at a glance who changed what and when, without needing to understand
Git.

Run by .github/workflows/cms-activity-log.yml: on its own daily schedule,
and on demand from the "Update CMS activity log" button on the CMS Actions
page (see docs/comments-setup.md-style comment in .pages.yml for how that
button mechanism works in general).

Deliberately a committed file, not a live API call from inside Pages CMS:
Pages CMS's content editors can only display files already in the repo, not
call arbitrary external APIs, so the one way to show "what changed recently"
there is to have something else (this script) write it into a file first.

WHAT COUNTS AS A "CMS commit": Pages CMS's own commit-message templates,
configured in .pages.yml's settings.commit.templates, are matched here by
the exact phrase "entry via Pages CMS" they all contain. A direct file
upload through the CMS's media library produces a different message
("Add files via upload") with no further detail available, so those are
listed too but without a collection/path breakdown. Anything else (this
project's own commits from manual edits or a prior assistant session, or a
push from the GitHub web UI) is deliberately excluded, even if made by the
same shared account the CMS commits as -- the goal is a log of CMS use
specifically, not a full commit history (GitHub's own "Commits" tab already
shows that, unfiltered).
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

REPO = os.environ.get("GITHUB_REPOSITORY", "")
TOKEN = os.environ.get("GITHUB_TOKEN", "")
# How many days of history to show, and the hard cap on how many commits to
# ever list even if that window is unusually busy (keeps the file readable
# and bounds the number of API calls below).
WINDOW_DAYS = int(os.environ.get("CMS_LOG_WINDOW_DAYS", "30"))
MAX_ENTRIES = int(os.environ.get("CMS_LOG_MAX_ENTRIES", "200"))
OUTPUT_PATH = "cms-activity-log.md"

API = f"https://api.github.com/repos/{REPO}"

# Matches the three templates in .pages.yml's settings.commit.templates
# ("Add/Update/Delete {name} entry via Pages CMS: {path}"), case-sensitively,
# since that's an exact match to what Pages CMS actually writes -- not a
# fuzzy pattern that might misclassify an unrelated commit that happens to
# share a few words.
CMS_TEMPLATE_RE = re.compile(r"^(Add|Update|Delete) (.+?) entry via Pages CMS: (.+)$")
UPLOAD_MESSAGE = "Add files via upload"


def api_get(path):
    req = urllib.request.Request(
        f"{API}/{path}",
        headers={"Authorization": f"token {TOKEN}", "Accept": "application/vnd.github+json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def fetch_recent_commits():
    """All commits on the default branch from the last WINDOW_DAYS, oldest
    excluded automatically once GitHub's `since` filter stops returning
    results -- paginated defensively up to a sane limit so one unusually
    busy window can't loop forever."""
    since_iso = (datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)).isoformat()
    commits, page = [], 1
    while page <= 10:  # 10 x 100 = 1000 commits is far beyond any realistic month of CMS use
        batch = api_get(f"commits?since={since_iso}&per_page=100&page={page}")
        if not batch:
            break
        commits.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return commits


def classify(commit):
    """Returns a dict describing one commit if it looks like CMS activity,
    or None if it should be left out of the log entirely."""
    message = commit["commit"]["message"].split("\n", 1)[0].strip()
    match = CMS_TEMPLATE_RE.match(message)
    if match:
        verb, collection, path = match.groups()
        return {
            "sha": commit["sha"],
            "when": commit["commit"]["author"]["date"],
            "who": commit["commit"]["author"]["name"] or "unknown",
            "verb": verb,
            "collection": collection,
            "path": path,
            "kind": "entry",
        }
    if message == UPLOAD_MESSAGE:
        return {
            "sha": commit["sha"],
            "when": commit["commit"]["author"]["date"],
            "who": commit["commit"]["author"]["name"] or "unknown",
            "verb": "Add",
            "collection": None,
            "path": None,
            "kind": "upload",
        }
    return None


IST = timezone(timedelta(hours=5, minutes=30))


def to_ist(iso_string_or_utc_dt):
    """Converts a UTC timestamp (either an ISO string, as GitHub's API
    returns, or an already-parsed datetime) to IST for display. Uses a
    fixed +5:30 offset rather than zoneinfo.ZoneInfo("Asia/Kolkata"): IST
    has had this exact, unchanging offset with no daylight saving since
    1947, so a fixed offset is correct, not an approximation, and avoids
    depending on the IANA timezone database being installed at all --
    GitHub's own ubuntu-latest runners are not guaranteed to have it
    (minimal Debian/Ubuntu images commonly ship without the tzdata
    package, which zoneinfo requires to resolve a named zone)."""
    if isinstance(iso_string_or_utc_dt, str):
        dt = datetime.fromisoformat(iso_string_or_utc_dt.replace("Z", "+00:00"))
    else:
        dt = iso_string_or_utc_dt
    return dt.astimezone(IST)


COLLECTION_LABELS = {
    "posts": "Newsletter post",
    "activities": "Activity",
    "profiles": "Profile",
    "videos": "Video",
    "photos": "Photo",
    "kfi": "Krishnamurti / Weekly Excerpt",
    "site-status": "Site status (maintenance switch)",
}


# Collections where path is always the same single file (a type: file entry
# in .pages.yml, not type: collection), so naming the file again after the
# collection label would just repeat it, e.g. "site status: maintenance".
SINGLE_FILE_COLLECTIONS = {"site-status"}


def describe_entry(e):
    """One plain sentence describing a single change -- no Markdown table,
    no [link](url) syntax, no backticks: Pages CMS's raw-file editor shows
    this file as plain text with no rendering, so anything that depends on
    Markdown being turned into formatting just shows as that literal
    punctuation instead (confirmed from a real screenshot)."""
    if e["kind"] == "upload":
        return "uploaded a file"
    label = COLLECTION_LABELS.get(e["collection"], e["collection"])
    verb = {"Add": "added", "Update": "updated", "Delete": "deleted"}[e["verb"]]
    if e["collection"] in SINGLE_FILE_COLLECTIONS:
        return f"{verb} the {label.lower()}"
    name = friendly_name(e["path"])
    return f"{verb} a {label.lower()}: {name}"


def friendly_name(path):
    """_posts/2026-07-17-card-club.md -> "card club" (strips the folder, the
    extension, and a leading YYYY-MM-DD- date stamp if present; falls back
    to the bare filename for anything that doesn't match that shape, e.g.
    _data/maintenance.yml)."""
    base = path.rsplit("/", 1)[-1]
    base = re.sub(r"\.(md|yml|yaml)$", "", base)
    base = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", base)
    return base.replace("-", " ").replace("_", " ").strip() or base


def build_markdown(entries, generated_at, repo_url, window_days):
    lines = []
    lines.append("CMS ACTIVITY LOG")
    lines.append("")
    lines.append(
        "This page is generated automatically. Typing here does not save "
        "anything -- it is replaced the next time this refreshes."
    )
    lines.append("")
    lines.append(
        f"Shows every change saved through the CMS in the last {window_days} "
        "days, newest first. Refreshes every night, and any time someone "
        'clicks "Update CMS activity log" on the Actions page.'
    )
    lines.append("")
    lines.append(f"Last updated: {generated_at}")
    lines.append("")
    lines.append("-" * 60)
    lines.append("")
    if not entries:
        lines.append(f"No changes were made through the CMS in the last {window_days} days.")
        lines.append("")
        return "\n".join(lines)

    current_day = None
    for e in entries:
        dt = to_ist(e["when"])
        day = dt.strftime("%A, %d %B %Y")
        if day != current_day:
            if current_day is not None:
                lines.append("")
            lines.append(day)
            lines.append("-" * len(day))
            current_day = day
        time = dt.strftime("%H:%M")
        who = e["who"]
        lines.append(f"  {time}  {who} {describe_entry(e)}")

    lines.append("")
    lines.append("-" * 60)
    lines.append("")
    count_note = f"{len(entries)} change(s) shown"
    if len(entries) >= MAX_ENTRIES:
        count_note += f" (capped at {MAX_ENTRIES})"
    lines.append(count_note + ".")
    lines.append("")
    return "\n".join(lines)


def main():
    if not REPO or not TOKEN:
        print("GITHUB_REPOSITORY and GITHUB_TOKEN must be set.", file=sys.stderr)
        sys.exit(1)
    try:
        commits = fetch_recent_commits()
    except urllib.error.HTTPError as err:
        print(f"Could not read commit history: HTTP {err.code}", file=sys.stderr)
        sys.exit(1)

    entries = []
    for c in commits:
        parsed = classify(c)
        if parsed:
            entries.append(parsed)
    entries.sort(key=lambda e: e["when"], reverse=True)
    entries = entries[:MAX_ENTRIES]

    generated_at = to_ist(datetime.now(timezone.utc)).strftime("%Y-%m-%d %H:%M IST")
    repo_url = f"https://github.com/{REPO}"
    markdown = build_markdown(entries, generated_at, repo_url, WINDOW_DAYS)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(markdown)
    print(f"Wrote {OUTPUT_PATH}: {len(entries)} entries from {len(commits)} commits scanned.")


if __name__ == "__main__":
    main()
