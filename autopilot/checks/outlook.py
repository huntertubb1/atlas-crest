"""Outlook web snapshot: open the dedicated profile, read the inbox list,
close the browser. Read-only — messages are never opened, moved, or marked;
only the list pane is parsed (so nothing even flips to "read").

Outlook web renders inbox rows as div[role=option] elements whose aria-label
concatenates sender / subject / preview / time, with a stable conversation
id in data-convid. If the DOM parse comes up empty (Outlook A/B-tests its
frontend constantly), we save a screenshot and let the digest step read it
with vision instead of failing the run.
"""
import hashlib
import re
from pathlib import Path

from .browser import SessionExpired, looks_like_outlook_login, wait_for_content


def _parse_rows(page, limit: int) -> list[dict]:
    messages = []
    rows = page.locator('div[role="option"]')
    count = min(rows.count(), limit)
    for i in range(count):
        row = rows.nth(i)
        try:
            label = row.get_attribute("aria-label") or row.inner_text() or ""
        except Exception:
            continue
        label = re.sub(r"\s+", " ", label).strip()
        if not label:
            continue
        conv_id = None
        try:
            conv_id = row.get_attribute("data-convid")
        except Exception:
            pass
        if not conv_id:
            # Stable-enough fallback: hash of the row text (sender+subject+time).
            conv_id = "h:" + hashlib.sha1(label.encode("utf-8")).hexdigest()[:16]
        messages.append({
            "id": conv_id,
            "summary": label[:400],
            "flagged": bool(re.search(r"\bflagged\b|\bhigh importance\b", label, re.I)),
            "unread": bool(re.match(r"^unread\b", label, re.I)),
        })
    return messages


def snapshot(page, outlook_url: str, run_dir: Path, max_messages: int = 40) -> dict:
    """Return {"messages": [...], "parse_failed": bool, "screenshot": path}.
    Raises SessionExpired if the profile's session is gone."""
    page.goto(outlook_url, wait_until="domcontentloaded")
    wait_for_content(page, ms=15_000)
    page.wait_for_timeout(4000)  # OWA hydrates the list well after DOM load

    if looks_like_outlook_login(page):
        raise SessionExpired("Outlook", "log in once in the autopilot Outlook profile")

    messages = _parse_rows(page, max_messages)
    shot_path = run_dir / "outlook_inbox.png"
    parse_failed = not messages
    try:
        page.screenshot(path=str(shot_path))
    except Exception:
        shot_path = None
    (run_dir / "outlook_rows.txt").write_text(
        "\n".join(m["summary"] for m in messages) or "(no rows parsed)",
        encoding="utf-8",
    )
    return {
        "messages": messages,
        "parse_failed": parse_failed,
        "screenshot": str(shot_path) if shot_path else None,
    }
