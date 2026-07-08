"""The ONE outbound channel (hard rule 2). Nothing else in this project may
send anything anywhere.

Modes:
  gmail  — send as Hunter via the Gmail API. The stored token carries only
           the gmail.send scope: it cannot read mail, and it's Hunter's own
           OAuth consent (see gmail_consent.py), not a saved password and
           not anything of Nate's.
  folder — write the digest as a .txt into a cloud-synced folder the Mac
           can see (fallback when Gmail OAuth isn't set up yet).

Every digest is also archived to runs/<stamp>/digest.txt by run.py, so
watch mode can always compare what was sent against what was on screen.
"""
import base64
import json
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TOKEN_PATH = ROOT / "secrets" / "token.json"
GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"


class DeliveryNotConfigured(Exception):
    pass


def send(cfg: dict, subject: str, body: str) -> str:
    """Deliver the digest. Returns a short human description of what
    happened, for the run log. One attempt — callers must not retry."""
    mode = cfg.get("delivery", "gmail")
    if mode == "gmail":
        return _send_gmail(cfg, subject, body)
    if mode == "folder":
        return _write_folder(cfg, subject, body)
    if mode == "stdout":  # --dry-run
        print(f"\n=== {subject} ===\n{body}\n")
        return "printed to stdout (dry run)"
    raise DeliveryNotConfigured(f"unknown delivery mode {mode!r}")


def _send_gmail(cfg: dict, subject: str, body: str) -> str:
    if not TOKEN_PATH.exists():
        raise DeliveryNotConfigured(
            f"{TOKEN_PATH} missing — run gmail_consent.py once (see README)"
        )
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), [GMAIL_SEND_SCOPE])
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_PATH.write_text(creds.to_json())

    to_addr = cfg["digest_to"]
    msg = EmailMessage()
    msg["To"] = to_addr
    msg["From"] = to_addr  # Hunter mailing Hunter
    msg["Subject"] = subject
    msg.set_content(body)
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return f"emailed {to_addr}"


def _write_folder(cfg: dict, subject: str, body: str) -> str:
    folder = Path(cfg.get("synced_folder") or "")
    if not str(folder) or not folder.parent.exists():
        raise DeliveryNotConfigured(
            "delivery=folder but synced_folder is unset or its parent doesn't exist"
        )
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    path = folder / f"crest-autopilot_{stamp}.txt"
    path.write_text(f"{subject}\n\n{body}\n", encoding="utf-8")
    return f"wrote {path}"


def load_config(path: Path) -> dict:
    if not path.exists():
        raise DeliveryNotConfigured(
            f"{path} missing — copy config.example.json to config.json"
        )
    return json.loads(path.read_text(encoding="utf-8"))
