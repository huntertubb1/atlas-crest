"""Last-seen snapshot between runs, so digests report deltas.

One JSON file (state.json). Fresh start — never reads Nate's databases.
Writes are atomic (tmp file + os.replace) so a crash mid-save can't leave a
half-written state that poisons the next run's delta.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

STATE_VERSION = 1
MAX_OUTLOOK_IDS = 500


def _empty_state() -> dict:
    return {
        "version": STATE_VERSION,
        "last_run_utc": None,
        "audits": {},            # ausum_id -> {insured, status, due_date, bucket, attach_count}
        "outlook_seen_ids": [],  # newest first
    }


def load(path: Path) -> dict:
    if not path.exists():
        return _empty_state()
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        # Corrupt state: treat as first run rather than crashing forever.
        # First-run behavior over-reports (everything looks new) instead of
        # silently under-reporting, which is the safe direction.
        return _empty_state()
    if state.get("version") != STATE_VERSION:
        return _empty_state()
    state.setdefault("audits", {})
    state.setdefault("outlook_seen_ids", [])
    return state


def save(path: Path, state: dict) -> None:
    state["version"] = STATE_VERSION
    state["last_run_utc"] = datetime.now(timezone.utc).isoformat()
    state["outlook_seen_ids"] = state.get("outlook_seen_ids", [])[:MAX_OUTLOOK_IDS]
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def compute_delta(prev: dict, ausum_audits: dict | None, outlook_msgs: list | None) -> dict:
    """Compare this run's snapshot against the previous one.

    ausum_audits / outlook_msgs are None when that check failed or hit a
    login page — a failed check must produce no delta (and must not later be
    written back as "seen"), otherwise everything re-reports next run or,
    worse, gets swallowed.
    """
    delta = {
        # Baseline framing: with nothing previously seen (true first run, or
        # every prior run failed), report the snapshot as a baseline rather
        # than as new activity.
        "first_run": not prev.get("audits") and not prev.get("outlook_seen_ids"),
        "new_audits": [],        # audit dicts
        "newly_returned": [],    # audit dicts (status flipped to Returned)
        "status_changes": [],    # {audit, field, before, after}
        "new_attachments": [],   # {audit, before, after}
        "new_messages": [],      # outlook message dicts
    }

    if ausum_audits is not None:
        prev_audits = prev.get("audits", {})
        for aid, audit in sorted(ausum_audits.items()):
            old = prev_audits.get(aid)
            if old is None:
                delta["new_audits"].append(audit)
                if audit.get("status") == "Returned":
                    delta["newly_returned"].append(audit)
                continue
            if audit.get("status") == "Returned" and old.get("status") != "Returned":
                delta["newly_returned"].append(audit)
            else:
                for field in ("status", "due_date"):
                    before, after = old.get(field, ""), audit.get(field, "")
                    if before and after and before != after:
                        delta["status_changes"].append(
                            {"audit": audit, "field": field, "before": before, "after": after}
                        )
            old_n, new_n = old.get("attach_count"), audit.get("attach_count")
            if old_n is not None and new_n is not None and new_n > old_n:
                delta["new_attachments"].append({"audit": audit, "before": old_n, "after": new_n})

    if outlook_msgs is not None:
        seen = set(prev.get("outlook_seen_ids", []))
        delta["new_messages"] = [m for m in outlook_msgs if m.get("id") and m["id"] not in seen]

    return delta


def has_changes(delta: dict) -> bool:
    return any(
        delta[k]
        for k in ("new_audits", "newly_returned", "status_changes", "new_attachments", "new_messages")
    )


def apply_run(state: dict, ausum_audits: dict | None, outlook_msgs: list | None) -> dict:
    """Fold this run's successful snapshots into state. Per-area: a check
    that failed (None) leaves its half of the state untouched, so the next
    successful run still reports what happened in the gap."""
    if ausum_audits is not None:
        state["audits"] = ausum_audits
    if outlook_msgs is not None:
        new_ids = [m["id"] for m in outlook_msgs if m.get("id")]
        merged = new_ids + [i for i in state.get("outlook_seen_ids", []) if i not in new_ids]
        state["outlook_seen_ids"] = merged[:MAX_OUTLOOK_IDS]
    return state
