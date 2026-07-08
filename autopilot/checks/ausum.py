"""AUSUM snapshot: walk the audit-list buckets, parse rows, open details for
attach counts, screenshot Returned audits so reviewer notes can be read
verbatim.

URLs, parsing regexes, and the navigation gotchas below are mined from
nate-system's tools/ausum_browser.py (reference, not import):
  - lists:  /audits-list.cfm?type={picked,assigned,pastdue,returned,entered}&auditor=1
  - detail: /audits-view.cfm?auditID=<id>&bypass=1&linkTicketID=<id>
  - pages 2+ POST via the JS changePage(srow) helper (1-based, 20 rows/page)
  - AUSUM silently redirects list navigations to the last-opened audit's
    detail page (linkTicketID) — re-navigate until the URL is really a list
  - never wait on networkidle (keep-alive heartbeats)

Strictly read-only: every navigation is a GET/list-page POST; no form on an
audit is ever touched.
"""
import re
from pathlib import Path

from .browser import SessionExpired, looks_like_ausum_login, wait_for_content

BUCKETS = ("picked", "assigned", "pastdue", "returned", "entered")
PAGE_SIZE = 20
MAX_PAGES_PER_BUCKET = 5  # 100 audits/bucket, far beyond a real caseload

STATUS_RE = re.compile(r"\b(PickedUp|Assigned|Returned|PastDue|Completed|Entered)\b")
DUE_RE = re.compile(r"(\d{2}/\d{2}/\d{4})\s*\(\d+\)")
ADDR_RE = re.compile(r"\(([^)]+,\s*[A-Z]{2}\s+\d{5})\)")
ATTACH_RE = re.compile(r"Attach\w*\s*\((\d+)\)", re.I)


def _goto_list(page, url: str) -> None:
    """Navigate to a list URL, defeating the linkTicketID auto-redirect."""
    for _ in range(3):
        page.goto(url, wait_until="domcontentloaded")
        wait_for_content(page)
        if "audits-list.cfm" in (page.url or "").lower():
            return
        if looks_like_ausum_login(page):
            raise SessionExpired("AUSUM")
    # Landed somewhere else three times; caller's parse of a non-list page
    # yields nothing for this bucket, which the coverage note surfaces.


def parse_list_text(body_text: str, bucket: str) -> dict:
    """Parse an audit-list page's inner text into {ausum_id: audit}.

    Rows carry a 7-digit AUSUM id either as "<row#> <id>" or standalone;
    standalone ids preceded by a "Last Term:"-style label are cross-refs,
    not rows. Field extraction scans the ~30 lines after the id.
    """
    audits = {}
    lines = body_text.splitlines()
    for i, line in enumerate(lines):
        stripped = line.strip()
        m = re.match(r"^\d+[\t ]+(\d{7})\s*$", stripped)
        if not m:
            m = re.match(r"^(\d{7})$", stripped)
            if m:
                prev = [l.strip() for l in lines[max(0, i - 4):i] if l.strip()]
                if any(re.match(r"^(last\s*term|reference|ref\.?)\s*:?$", p, re.I) for p in prev):
                    m = None
        if not m or m.group(1) in audits:
            continue
        aid = m.group(1)
        chunk = lines[i:i + 30]
        chunk_text = "\n".join(chunk)

        insured = ""
        for ln in chunk[1:15]:
            ln = ln.strip()
            if (not ln or len(ln) < 4
                    or ln.startswith(("Notes", "Last", "Audit", "Address"))
                    or re.match(r"^[\d/\(\)\s]+$", ln)):
                continue
            if re.search(r"[A-Z]{2,}", ln) and len(ln) > 5:
                insured = ln
                break

        status_m = STATUS_RE.search(chunk_text)
        due_m = DUE_RE.search(chunk_text)
        addr_m = ADDR_RE.search(chunk_text)
        audits[aid] = {
            "ausum_id": aid,
            "insured": insured,
            "status": status_m.group(1) if status_m else bucket,
            "due_date": due_m.group(1) if due_m else "",
            "address": addr_m.group(1) if addr_m else "",
            "bucket": bucket,
            "attach_count": None,
        }
    return audits


def snapshot(page, base_url: str, run_dir: Path, max_detail_visits: int = 20) -> dict:
    """Return {"audits": {id: audit}, "returned_material": {id: {...}},
    "coverage_notes": [...]}. Raises SessionExpired on a login page."""
    base = base_url.rstrip("/")
    audits: dict = {}
    coverage: list[str] = []

    page.goto(f"{base}/index.cfm", wait_until="domcontentloaded")
    wait_for_content(page)
    if looks_like_ausum_login(page):
        raise SessionExpired("AUSUM")

    for bucket in BUCKETS:
        url = f"{base}/audits-list.cfm?type={bucket}&auditor=1"
        _goto_list(page, url)
        seen_in_bucket: set[str] = set()
        for page_idx in range(MAX_PAGES_PER_BUCKET):
            if page_idx > 0:
                srow = page_idx * PAGE_SIZE + 1
                try:
                    page.evaluate(
                        "(srow) => { if (typeof changePage === 'function') changePage(srow); }",
                        srow,
                    )
                except Exception:
                    break
                wait_for_content(page)
            body = page.inner_text("body") or ""
            found = parse_list_text(body, bucket)
            new_ids = [a for a in found if a not in seen_in_bucket]
            seen_in_bucket.update(found)
            for aid, audit in found.items():
                audits.setdefault(aid, audit)
            (run_dir / f"ausum_{bucket}_p{page_idx}.txt").write_text(
                body[:60_000], encoding="utf-8"
            )
            if not new_ids or len(found) < PAGE_SIZE:
                break
        else:
            coverage.append(f"'{bucket}' list hit the {MAX_PAGES_PER_BUCKET}-page cap")

    # Detail visits: attach counts for everyone (capped), screenshots for
    # Returned audits so the digest can quote reviewer notes verbatim.
    returned_ids = [a for a, d in audits.items() if d["status"] == "Returned"]
    others = sorted(
        (a for a in audits if a not in returned_ids),
        key=lambda a: audits[a].get("due_date") or "99/99/9999",
    )
    to_visit = (returned_ids + others)[:max_detail_visits]
    if len(audits) > len(to_visit):
        coverage.append(
            f"attachment check covered {len(to_visit)} of {len(audits)} audits "
            f"(per-run cap)"
        )

    returned_material: dict = {}
    for aid in to_visit:
        detail_url = f"{base}/audits-view.cfm?auditID={aid}&bypass=1&linkTicketID={aid}"
        try:
            page.goto(detail_url, wait_until="domcontentloaded")
            wait_for_content(page)
            if looks_like_ausum_login(page):
                raise SessionExpired("AUSUM", "mid-run on a detail page")
            body = page.inner_text("body") or ""
            attach_m = ATTACH_RE.search(body)
            if attach_m:
                audits[aid]["attach_count"] = int(attach_m.group(1))
            if aid in returned_ids:
                text_path = run_dir / f"returned_{aid}.txt"
                shot_path = run_dir / f"returned_{aid}.png"
                text_path.write_text(body[:60_000], encoding="utf-8")
                page.screenshot(path=str(shot_path), full_page=True)
                returned_material[aid] = {
                    "insured": audits[aid].get("insured", ""),
                    "text": str(text_path),
                    "screenshot": str(shot_path),
                }
        except SessionExpired:
            raise
        except Exception as e:
            coverage.append(f"detail page for {aid} failed: {type(e).__name__}")

    return {
        "audits": audits,
        "returned_material": returned_material,
        "coverage_notes": coverage,
    }
