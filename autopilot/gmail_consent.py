"""One-time setup: mint a SEND-ONLY Gmail token as hunter@atlascrestllc.com.

Same pattern nate-system used for the hunter@ read token, but scoped down
further: gmail.send only. The laptop can email Hunter the digest and can do
nothing else with the mailbox — it can't even read it. No password touches
disk; the token is Hunter's own revocable OAuth grant
(myaccount.google.com → Security → Third-party access to revoke).

Prereq: secrets/oauth_client.json — a Desktop-app OAuth client from
HUNTER'S OWN Google Cloud project (README has the 4 console steps). Do not
reuse anything out of C:\\nate-system\\config — Nate's credentials are
cancelled and stay that way.

Run once, on the laptop, in a browser signed in as hunter@:

    venv\\Scripts\\python.exe gmail_consent.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CLIENT_PATH = ROOT / "secrets" / "oauth_client.json"
TOKEN_PATH = ROOT / "secrets" / "token.json"
SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


def main():
    if not CLIENT_PATH.exists():
        sys.exit(
            f"{CLIENT_PATH} not found.\n"
            "Create a Desktop-app OAuth client in Hunter's own Google Cloud "
            "project (README → 'Gmail delivery') and save its JSON there, "
            "then re-run this."
        )
    from google_auth_oauthlib.flow import InstalledAppFlow

    print("Opening a browser — sign in as hunter@atlascrestllc.com and approve "
          "SEND-ONLY Gmail access.\n")
    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_PATH), SCOPES)
    creds = flow.run_local_server(port=0)
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_PATH.write_text(creds.to_json())
    print(f"\n[OK] Wrote {TOKEN_PATH}")
    print("Digest delivery is ready. Test it with: venv\\Scripts\\python.exe "
          "run.py --dry-run  (then a real run without --dry-run).")


if __name__ == "__main__":
    main()
