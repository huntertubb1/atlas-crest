"""Crest Autopilot — one scheduled run. Fired by Task Scheduler via
run_autopilot.bat; also runnable by hand (add --dry-run to print the digest
instead of sending it).

Shape of a run (hard rules 3–5 live here):
  - ONE attempt at everything. Any check that fails is reported in the
    digest, never retried.
  - A wall-clock deadline (config run_deadline_minutes) is checked between
    phases; blowing it turns the run into a failure digest.
  - "Nothing changed and nothing broke" sends NOTHING — silence = all quiet.
    Session-expired and run-failed always send.
  - State is only advanced for checks that succeeded, so a broken check's
    changes still show up in the next successful run's digest.

Exit codes: 0 quiet/sent, 1 run failed (Task Scheduler shows it; no retry
is configured there either).
"""
import argparse
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path

import statestore
import delivery
import digestgen
from checks import ausum, outlook
from checks.browser import (
    ChromeNotRunning, SessionExpired, ausum_page, outlook_page,
)

ROOT = Path(__file__).resolve().parent
STATE_PATH = ROOT / "state.json"
CONFIG_PATH = ROOT / "config.json"


class DeadlineExceeded(Exception):
    pass


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="print the digest instead of sending it")
    parser.add_argument("--skip-outlook", action="store_true",
                        help="AUSUM only (useful mid-setup)")
    args = parser.parse_args()

    cfg = delivery.load_config(CONFIG_PATH)
    if args.dry_run:
        cfg["delivery"] = "stdout"

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = ROOT / "runs" / stamp
    run_dir.mkdir(parents=True, exist_ok=True)
    log_path = run_dir / "run.log"

    def log(msg: str):
        line = f"{datetime.now().strftime('%H:%M:%S')} {msg}"
        print(line)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(line + "\n")

    deadline = time.monotonic() + cfg.get("run_deadline_minutes", 20) * 60

    def checkpoint(phase: str):
        if time.monotonic() > deadline:
            raise DeadlineExceeded(f"run deadline hit before {phase}")

    problems: list[str] = []       # human-readable, lead the digest
    coverage: list[str] = []
    ausum_audits = None            # None = check failed, don't advance state
    returned_material: dict = {}
    outlook_msgs = None
    outlook_msgs_for_state = None

    # ---- AUSUM ----
    try:
        checkpoint("AUSUM check")
        log("AUSUM: attaching to persistent Chrome")
        with ausum_page(cfg.get("ausum_cdp_url", "http://127.0.0.1:9222")) as page:
            result = ausum.snapshot(
                page, cfg["ausum_base_url"], run_dir,
                max_detail_visits=cfg.get("max_detail_visits", 20),
            )
        ausum_audits = result["audits"]
        returned_material = result["returned_material"]
        coverage += result["coverage_notes"]
        log(f"AUSUM: {len(ausum_audits)} audits, "
            f"{len(returned_material)} returned with material")
    except SessionExpired:
        problems.append("AUSUM session expired — tap the laptop and log in "
                        "(the persistent AUSUM Chrome window)")
        log("AUSUM: login page — stopping that check (MFA is never automated)")
    except ChromeNotRunning as e:
        problems.append(str(e))
        log(f"AUSUM: {e}")
    except DeadlineExceeded:
        raise
    except Exception as e:
        problems.append(f"AUSUM check failed ({type(e).__name__}) — see runs\\{stamp}")
        log(f"AUSUM: FAILED\n{traceback.format_exc()}")

    # ---- Outlook ----
    if not args.skip_outlook:
        try:
            checkpoint("Outlook check")
            log("Outlook: opening dedicated profile")
            with outlook_page(ROOT / cfg.get("outlook_profile_dir", "profiles/outlook")) as page:
                result = outlook.snapshot(
                    page, cfg.get("outlook_url", "https://outlook.office.com/mail/"),
                    run_dir, max_messages=cfg.get("outlook_max_messages", 40),
                )
            if result["parse_failed"]:
                # No rows parsed: the check is blind, which must not look
                # like "all quiet". Report it; don't advance seen-ids.
                problems.append("Outlook check went blind — inbox parse came up "
                                f"empty (frontend change?), screenshot in runs\\{stamp}")
                outlook_msgs = []
            else:
                outlook_msgs = result["messages"]
                outlook_msgs_for_state = result["messages"]
            log(f"Outlook: {len(result['messages'])} rows")
        except SessionExpired:
            problems.append("Outlook session expired — on the laptop run "
                            "setup_outlook.py and sign in with 'Stay signed in'")
            log("Outlook: login page — stopping that check")
        except DeadlineExceeded:
            raise
        except Exception as e:
            problems.append(f"Outlook check failed ({type(e).__name__}) — see runs\\{stamp}")
            log(f"Outlook: FAILED\n{traceback.format_exc()}")

    # ---- Delta + digest ----
    checkpoint("digest")
    state = statestore.load(STATE_PATH)
    delta = statestore.compute_delta(state, ausum_audits, outlook_msgs)

    if not problems and not statestore.has_changes(delta):
        state = statestore.apply_run(state, ausum_audits, outlook_msgs_for_state)
        statestore.save(STATE_PATH, state)
        log("All quiet — no digest (silence = nothing changed)")
        return 0

    budget = digestgen.ClaudeBudget(
        max_calls=cfg.get("claude_max_calls_per_run", 6),
        timeout_s=cfg.get("claude_call_timeout_s", 180),
        cli=cfg.get("claude_cli", "claude"),
    )
    newly_returned_ids = {a["ausum_id"] for a in delta["newly_returned"]}
    notes = digestgen.extract_reviewer_notes(
        {aid: m for aid, m in returned_material.items() if aid in newly_returned_ids},
        budget,
    )
    body = digestgen.write_digest(delta, notes, problems, coverage, budget)
    subject = digestgen.subject_line(delta, problems)
    (run_dir / "digest.txt").write_text(f"{subject}\n\n{body}\n", encoding="utf-8")

    outcome = delivery.send(cfg, subject, body)
    log(f"Digest: {outcome}")

    state = statestore.apply_run(state, ausum_audits, outlook_msgs_for_state)
    statestore.save(STATE_PATH, state)
    return 0


def _failure_digest(exc: Exception):
    """Last resort: one line, one attempt, then give up (hard rule 3)."""
    line = f"Autopilot run failed: {type(exc).__name__}: {exc}"
    try:
        cfg = delivery.load_config(CONFIG_PATH)
        delivery.send(cfg, "Crest Autopilot — run failed", line)
    except Exception:
        print(line, file=sys.stderr)  # ends up in logs\runs.log


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as e:
        traceback.print_exc()
        _failure_digest(e)
        sys.exit(1)
