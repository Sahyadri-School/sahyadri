#!/usr/bin/env python3
"""
report_external_links.py — CI helper, used only by the weekly
external-links workflow.

Reads the captured output of check_external_links.rb and manages a
single persistent GitHub Issue titled ISSUE_TITLE:
  - If the check found broken links: creates that issue if it doesn't
    exist yet, reopens it if it was closed, and adds a comment with the
    current findings. This is what actually triggers a GitHub
    notification (and, for most accounts, an email) -- nothing else in
    this workflow does.
  - If the check found nothing wrong: stays completely silent, unless
    there's a currently-open issue from a past failure, in which case
    it adds an "all clear now" comment and closes it. No news is good
    news -- this script does not ping anyone just to say nothing broke.

Uses the GITHUB_TOKEN GitHub Actions provides automatically to every
workflow run; no separate secret needs to be created for this to work.
"""
import os
import sys
import requests

ISSUE_TITLE = "External Link Check"
REPO = os.environ["GITHUB_REPOSITORY"]  # "owner/repo", set automatically by Actions
TOKEN = os.environ["GITHUB_TOKEN"]
API = f"https://api.github.com/repos/{REPO}"
HEADERS = {"Authorization": f"token {TOKEN}", "Accept": "application/vnd.github+json"}


def find_existing_issue():
    # Searches both open and closed issues for an exact title match.
    resp = requests.get(f"{API}/issues", headers=HEADERS, params={"state": "all", "per_page": 100})
    resp.raise_for_status()
    for issue in resp.json():
        if issue.get("title") == ISSUE_TITLE and "pull_request" not in issue:
            return issue
    return None


def create_issue(body):
    resp = requests.post(f"{API}/issues", headers=HEADERS, json={"title": ISSUE_TITLE, "body": body})
    resp.raise_for_status()
    return resp.json()


def comment_on_issue(number, body):
    resp = requests.post(f"{API}/issues/{number}/comments", headers=HEADERS, json={"body": body})
    resp.raise_for_status()


def set_issue_state(number, state):
    resp = requests.patch(f"{API}/issues/{number}", headers=HEADERS, json={"state": state})
    resp.raise_for_status()


def main():
    with open("/tmp/external_link_output.txt", encoding="utf-8") as f:
        output = f.read()
    failed = "HTML-Proofer found" in output and "failures!" in output

    existing = find_existing_issue()

    if failed:
        body = (
            "Automated weekly check found one or more broken external links.\n\n"
            "```\n" + output.strip()[-6000:] + "\n```\n\n"
            "_This check only looks at external links (the site's own build "
            "already checks internal links/images/scripts on every push). "
            "A failure here doesn't affect the live site — it's just flagging "
            "something worth a look when convenient."
        )
        if existing is None:
            issue = create_issue(body)
            print(f"Created issue #{issue['number']}")
        else:
            if existing["state"] == "closed":
                set_issue_state(existing["number"], "open")
            comment_on_issue(existing["number"], body)
            print(f"Commented on issue #{existing['number']}")
    else:
        print("No broken external links found.")
        if existing is not None and existing["state"] == "open":
            comment_on_issue(existing["number"], "All external links checked clean this week — closing.")
            set_issue_state(existing["number"], "closed")
            print(f"Closed issue #{existing['number']}")


if __name__ == "__main__":
    main()
