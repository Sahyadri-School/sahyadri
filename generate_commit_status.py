#!/usr/bin/env python3
"""
generate_commit_status.py

Builds commit-status.md: a plain, readable list of the site's recent builds
and deploys, read from this repository's GitHub Actions run history. Written
so a non-technical person can open it in the CMS sidebar (wired up in
.pages.yml as a read-only "Commit Status" file entry) and see, at a glance,
whether a given change actually made it onto the live site -- without
needing to understand GitHub Actions or open the Actions tab themselves.

Answers a different question from cms-activity-log.md (generate_cms_log.py):
that file lists what was changed through the CMS; this one lists whether
each resulting change to the site actually built and deployed successfully.
A CMS save failing to build is rare but not impossible (a broken link, a
malformed file), and previously had no visible sign of trouble anywhere a
non-technical editor would think to look -- GitHub's own Actions tab shows
it, but isn't somewhere the CMS points anyone towards.

Run by .github/workflows/commit-status.yml: on its own schedule, and on
demand from the "Update commit status" button on the CMS Actions page (same
payload-input mechanism used by the other two workflows already in this
repo -- see the comment in external-links.yml for how that works).

WHAT THIS LISTS: the site's main build-and-deploy workflow
(.github/workflows/ci.yml) runs on every push to master, whatever the
source -- a CMS save, a direct GitHub edit, or anything else -- so, unlike
the activity log, this is NOT filtered to CMS-only changes; it is deliberately
the complete recent build history, since a non-CMS change can break the site
exactly as easily as a CMS one, and the whole point of this file is "is the
site actually working right now", not "what did the CMS do".
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

REPO = os.environ.get("GITHUB_REPOSITORY", "")
TOKEN = os.environ.get("GITHUB_TOKEN", "")
WORKFLOW_FILE = os.environ.get("CI_WORKFLOW_FILE", "ci.yml")
WINDOW_DAYS = int(os.environ.get("COMMIT_STATUS_WINDOW_DAYS", "30"))
MAX_ENTRIES = int(os.environ.get("COMMIT_STATUS_MAX_ENTRIES", "100"))
OUTPUT_PATH = "commit-status.md"

API = f"https://api.github.com/repos/{REPO}"
IST = timezone(timedelta(hours=5, minutes=30))  # see generate_cms_log.py's to_ist() for why a fixed offset, not zoneinfo


def api_get(path):
    req = urllib.request.Request(
        f"{API}/{path}",
        headers={"Authorization": f"token {TOKEN}", "Accept": "application/vnd.github+json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def fetch_recent_runs():
    """Every run of the main build workflow from the last WINDOW_DAYS,
    newest first (the API already returns them in that order), paginated
    defensively up to a sane cap -- this workflow runs on every push, so a
    very busy month could otherwise mean an unbounded number of calls."""
    runs, page = [], 1
    cutoff = datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)
    while page <= 10:  # 10 x 100 = 1000 runs; far beyond any realistic month
        batch = api_get(f"actions/workflows/{WORKFLOW_FILE}/runs?per_page=100&page={page}")
        workflow_runs = batch.get("workflow_runs", [])
        if not workflow_runs:
            break
        stop = False
        for r in workflow_runs:
            created = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
            if created < cutoff:
                stop = True
                break
            runs.append(r)
        if stop or len(workflow_runs) < 100:
            break
        page += 1
    return runs[:MAX_ENTRIES]


def fetch_job_outcomes(run_id):
    """The build and deploy jobs' individual conclusions for one run (the
    run's own top-level conclusion is only the combined result). Returns a
    dict like {"build": "success", "deploy": "success"}; a job name not in
    this dict means that job hasn't started or doesn't exist for this run.
    One extra API call per run -- acceptable at this site's volume (see the
    module docstring; MAX_ENTRIES also bounds the worst case)."""
    try:
        data = api_get(f"actions/runs/{run_id}/jobs")
    except urllib.error.HTTPError as err:
        print(f"Could not read jobs for run {run_id}: HTTP {err.code}", file=sys.stderr)
        return {}
    return {j["name"]: (j["conclusion"] or j["status"]) for j in data.get("jobs", [])}


def to_ist(iso_string):
    return datetime.fromisoformat(iso_string.replace("Z", "+00:00")).astimezone(IST)


# Plain-English phrasing for every outcome GitHub can report. "in_progress"
# etc. are job *statuses* (used while still running); everything else here
# is a job *conclusion* (the final result) -- fetch_job_outcomes() returns
# whichever one currently applies, since an in-progress job has no
# conclusion yet.
OUTCOME_WORDS = {
    "success": "OK",
    "failure": "FAILED",
    "cancelled": "cancelled",
    "skipped": "skipped",
    "timed_out": "timed out",
    "action_required": "needs action",
    "neutral": "neutral",
    "stale": "stale",
    "in_progress": "still running",
    "queued": "queued",
    "waiting": "waiting",
    "pending": "pending",
}


def describe_run(run, job_outcomes):
    """One plain sentence summarizing a single build: what happened to the
    build step and, if it got that far, the deploy step. No Markdown table,
    no [link](url) syntax: Pages CMS's raw-file editor shows this file as
    literal text with no rendering (confirmed from a real screenshot on a
    different file in this repo, cms-activity-log.md, before it was
    rewritten away from a Markdown table for the same reason)."""
    build = job_outcomes.get("build")
    deploy = job_outcomes.get("deploy")

    if build == "cancelled":
        # ci.yml sets cancel-in-progress: true, so this happens whenever a
        # newer push arrives before an older build finishes -- routine, not
        # a sign of trouble. The newer commit gets its own build, which
        # reflects the site's real current state.
        return "Build was stopped early because a newer change was saved right after it; that newer change has its own, separate result below."
    build_word = OUTCOME_WORDS.get(build, build or "unknown")
    if build != "success":
        return f"Build {build_word} -- the site was NOT updated with this change."
    if deploy is None:
        return "Build OK, deploy did not run."
    if deploy == "success":
        return "Build OK, deployed -- this change is live."
    if deploy == "cancelled":
        return "Build OK; deploy was stopped early because a newer change was saved right after it."
    deploy_word = OUTCOME_WORDS.get(deploy, deploy)
    return f"Build OK, but deploy {deploy_word} -- this change may not be live yet."


def commit_summary(run):
    head_commit = run.get("head_commit") or {}
    message = (head_commit.get("message") or run.get("display_title") or "").split("\n", 1)[0].strip()
    author = (head_commit.get("author") or {}).get("name") or (run.get("actor") or {}).get("login") or "unknown"
    return message, author


def build_markdown(runs_with_outcomes, generated_at, window_days):
    lines = []
    lines.append("COMMIT STATUS")
    lines.append("")
    lines.append(
        "This page is generated automatically. Typing here does not save "
        "anything -- it is replaced the next time this refreshes."
    )
    lines.append("")
    lines.append(
        f"Shows whether each change in the last {window_days} days actually "
        "built and went live on the site -- not just what was saved through "
        "the CMS (see CMS Activity Log for that), but every change, from any "
        "source. Refreshes once a day at midnight (IST), and any time someone clicks "
        '"Update commit status" on the Actions page.'
    )
    lines.append("")
    lines.append(f"Last updated: {generated_at}")
    lines.append("")
    lines.append("-" * 60)
    lines.append("")

    if not runs_with_outcomes:
        lines.append(f"No builds in the last {window_days} days.")
        lines.append("")
        return "\n".join(lines)

    def is_real_problem(o):
        build, deploy = o.get("build"), o.get("deploy")
        if build == "cancelled":
            return False  # routine: a newer change was saved first, see describe_run()
        if build != "success":
            return True
        return deploy not in (None, "success", "cancelled")

    problems = [r for r, o, _ in runs_with_outcomes if is_real_problem(o)]
    if problems:
        lines.append(f"{len(problems)} of the last {len(runs_with_outcomes)} shown below did NOT go live cleanly -- see below.")
    else:
        lines.append(f"All {len(runs_with_outcomes)} shown below built and went live with no problems (a few may show as \"stopped early\", which is routine, not a problem -- see below).")
    lines.append("")
    lines.append("-" * 60)
    lines.append("")

    current_day = None
    for run, job_outcomes, (message, author) in runs_with_outcomes:
        dt = to_ist(run["created_at"])
        day = dt.strftime("%A, %d %B %Y")
        if day != current_day:
            if current_day is not None:
                lines.append("")
            lines.append(day)
            lines.append("-" * len(day))
            current_day = day
        time = dt.strftime("%H:%M")
        lines.append(f"  {time}  {author}: {message}")
        lines.append(f"          {describe_run(run, job_outcomes)}")
        lines.append(f"          Details: {run['html_url']}")

    lines.append("")
    lines.append("-" * 60)
    lines.append("")
    count_note = f"{len(runs_with_outcomes)} build(s) shown"
    if len(runs_with_outcomes) >= MAX_ENTRIES:
        count_note += f" (capped at {MAX_ENTRIES})"
    lines.append(count_note + ".")
    lines.append("")
    return "\n".join(lines)


def main():
    if not REPO or not TOKEN:
        print("GITHUB_REPOSITORY and GITHUB_TOKEN must be set.", file=sys.stderr)
        sys.exit(1)
    try:
        runs = fetch_recent_runs()
    except urllib.error.HTTPError as err:
        print(f"Could not read workflow run history: HTTP {err.code}", file=sys.stderr)
        sys.exit(1)

    runs_with_outcomes = []
    for run in runs:
        job_outcomes = fetch_job_outcomes(run["id"])
        runs_with_outcomes.append((run, job_outcomes, commit_summary(run)))

    generated_at = datetime.now(timezone.utc).astimezone(IST).strftime("%Y-%m-%d %H:%M IST")
    markdown = build_markdown(runs_with_outcomes, generated_at, WINDOW_DAYS)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(markdown)
    print(f"Wrote {OUTPUT_PATH}: {len(runs_with_outcomes)} runs.")


if __name__ == "__main__":
    main()
