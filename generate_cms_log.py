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
from datetime import datetime, timezone

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
    from datetime import timedelta
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


def format_when(iso_string):
    dt = datetime.fromisoformat(iso_string.replace("Z", "+00:00"))
    return dt.strftime("%Y-%m-%d %H:%M UTC")


def escape_md(text):
    """Only neutralizes the one character (|) that would break a Markdown
    table row if a filename ever contained it; deliberately not a general
    Markdown escaper, since paths/names here are shown as plain inline code
    (backticks), which already suppresses *, _, [] etc."""
    return text.replace("|", "\\|")


def build_markdown(entries, generated_at, repo_url, window_days):
    lines = []
    lines.append("---")
    lines.append("")
    lines.append(
        "This file is generated automatically -- edits made here are not saved "
        "and will be overwritten the next time it refreshes."
    )
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("# CMS activity log")
    lines.append("")
    lines.append(
        f"Every change saved through this CMS in the last {window_days} days, "
        "newest first. Generated by a scheduled check and by the "
        '"Update CMS activity log" button on the Actions page.'
    )
    lines.append("")
    lines.append(f"Last updated: **{generated_at}**")
    lines.append("")
    if not entries:
        lines.append(f"No changes were made through the CMS in the last {window_days} days.")
        lines.append("")
        return "\n".join(lines)

    lines.append("| When | Who | Change | Collection | File |")
    lines.append("|---|---|---|---|---|")
    for e in entries:
        when = format_when(e["when"])
        who = escape_md(e["who"])
        commit_link = f"[{e['sha'][:7]}]({repo_url}/commit/{e['sha']})"
        if e["kind"] == "upload":
            lines.append(f"| {when} | {who} | File upload | — | ({commit_link}) |")
        else:
            collection = escape_md(e["collection"])
            path = escape_md(e["path"])
            lines.append(f"| {when} | {who} | {e['verb']} | {collection} | `{path}` ({commit_link}) |")
    lines.append("")
    lines.append(f"{len(entries)} change(s) shown" + (f" (capped at {MAX_ENTRIES})" if len(entries) >= MAX_ENTRIES else "") + ".")
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

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    repo_url = f"https://github.com/{REPO}"
    markdown = build_markdown(entries, generated_at, repo_url, WINDOW_DAYS)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(markdown)
    print(f"Wrote {OUTPUT_PATH}: {len(entries)} entries from {len(commits)} commits scanned.")


if __name__ == "__main__":
    main()
