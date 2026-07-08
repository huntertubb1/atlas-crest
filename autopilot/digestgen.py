"""Turn a delta into the short plain-English digest.

Claude (headless `claude -p`, Hunter's own login, no API key on disk) does
two bounded jobs:
  1. read reviewer notes verbatim off Returned-audit screenshots/text dumps
  2. write the digest prose from the computed delta

Both are hard-capped: at most `claude_max_calls_per_run` subprocesses, each
with --max-turns and a wall-clock timeout, cwd'd into this folder so
CLAUDE.md (hard rules) and .claude/settings.json (read-only permissions,
runs/ only) apply. If Claude is unavailable or the cap is hit, a
deterministic plain-text rendering ships instead — the digest is never
skipped because the pretty-printer failed.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class ClaudeBudget:
    """Per-run cap on Claude subprocesses (hard rule 3)."""

    def __init__(self, max_calls: int, timeout_s: int, cli: str = "claude"):
        self.remaining = max_calls
        self.timeout_s = timeout_s
        self.cli = cli

    def call(self, prompt: str, max_turns: int, allow_read: bool = False) -> str | None:
        """One claude -p invocation; None on any failure (no retries)."""
        if self.remaining <= 0:
            return None
        self.remaining -= 1
        cmd = [self.cli, "-p", prompt, "--output-format", "text",
               "--max-turns", str(max_turns)]
        if allow_read:
            cmd += ["--allowedTools", "Read"]
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, encoding="utf-8",
                timeout=self.timeout_s, cwd=str(ROOT),
            )
        except (subprocess.TimeoutExpired, OSError):
            return None
        if result.returncode != 0:
            return None
        out = (result.stdout or "").strip()
        return out or None


def _prompt(name: str) -> str:
    return (ROOT / "prompts" / name).read_text(encoding="utf-8")


def extract_reviewer_notes(returned_material: dict, budget: ClaudeBudget) -> dict:
    """{ausum_id: verbatim notes or ''}. One Read-only claude call per
    newly-returned audit; misses degrade to a 'see AUSUM' line, never retry."""
    notes = {}
    for aid, mat in returned_material.items():
        prompt = _prompt("reviewer_notes.md").format(
            ausum_id=aid,
            insured=mat.get("insured", ""),
            text_path=mat["text"],
            screenshot_path=mat["screenshot"],
        )
        out = budget.call(prompt, max_turns=6, allow_read=True)
        notes[aid] = out or ""
    return notes


def _fallback_digest(delta: dict, reviewer_notes: dict, problems: list[str],
                     coverage: list[str]) -> str:
    """Deterministic rendering — accurate, just not prose."""
    lines = []
    if problems:
        lines += [f"!! {p}" for p in problems] + [""]
    if delta.get("first_run"):
        lines.append("First run — everything below is the current baseline, not new activity.")
    for a in delta["new_audits"]:
        lines.append(f"New audit: {a.get('insured') or '?'} {a['ausum_id']}"
                     f" (due {a.get('due_date') or '?'}, status {a.get('status')})")
    for a in delta["newly_returned"]:
        lines.append(f"RETURNED: {a.get('insured') or '?'} {a['ausum_id']} — QC notes:")
        note = reviewer_notes.get(a["ausum_id"], "")
        lines.append(note if note else "  (couldn't read notes — open the audit in AUSUM)")
    for c in delta["status_changes"]:
        a = c["audit"]
        lines.append(f"{a.get('insured') or '?'} {a['ausum_id']}: {c['field']} "
                     f"{c['before']} -> {c['after']}")
    for c in delta["new_attachments"]:
        a = c["audit"]
        lines.append(f"{a.get('insured') or '?'} {a['ausum_id']}: attachments "
                     f"{c['before']} -> {c['after']} (insured uploaded docs?)")
    if delta["new_messages"]:
        lines.append(f"Outlook — {len(delta['new_messages'])} new message(s):")
        for m in delta["new_messages"]:
            prefix = "FLAGGED: " if m.get("flagged") else "- "
            lines.append(f"{prefix}{m['summary'][:200]}")
    if coverage:
        lines += [""] + [f"(coverage: {c})" for c in coverage]
    return "\n".join(lines).strip()


def write_digest(delta: dict, reviewer_notes: dict, problems: list[str],
                 coverage: list[str], budget: ClaudeBudget) -> str:
    fallback = _fallback_digest(delta, reviewer_notes, problems, coverage)
    material = {
        "problems": problems,
        "first_run": delta.get("first_run", False),
        "new_audits": delta["new_audits"],
        "newly_returned": [
            {**a, "reviewer_notes": reviewer_notes.get(a["ausum_id"], "")}
            for a in delta["newly_returned"]
        ],
        "status_changes": [
            {"audit_id": c["audit"]["ausum_id"], "insured": c["audit"].get("insured", ""),
             "field": c["field"], "before": c["before"], "after": c["after"]}
            for c in delta["status_changes"]
        ],
        "new_attachments": [
            {"audit_id": c["audit"]["ausum_id"], "insured": c["audit"].get("insured", ""),
             "before": c["before"], "after": c["after"]}
            for c in delta["new_attachments"]
        ],
        "new_outlook_messages": delta["new_messages"],
        "coverage_notes": coverage,
    }
    prompt = _prompt("digest.md").format(material=json.dumps(material, indent=2))
    out = budget.call(prompt, max_turns=1)
    return out or fallback


def subject_line(delta: dict, problems: list[str]) -> str:
    if problems:
        return f"Crest Autopilot — {problems[0]}"
    bits = []
    if delta["new_audits"]:
        bits.append(f"{len(delta['new_audits'])} new")
    if delta["newly_returned"]:
        bits.append(f"{len(delta['newly_returned'])} returned")
    if delta["new_attachments"]:
        bits.append(f"{len(delta['new_attachments'])} new docs")
    if delta["status_changes"]:
        bits.append(f"{len(delta['status_changes'])} changed")
    if delta["new_messages"]:
        bits.append(f"{len(delta['new_messages'])} emails")
    return "Crest Autopilot — " + (", ".join(bits) if bits else "update")
