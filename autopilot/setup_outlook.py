"""One-time (and after-expiry) setup for the dedicated Outlook Chrome
profile. Opens a browser on profiles/outlook pointed at Outlook web; Hunter
signs in as hunter.tubb@davies-services.com, does MFA, and — the important
part — ticks **"Stay signed in"** so the session persists in the profile.

Run it, log in, then come back to this console and press Enter.

    venv\\Scripts\\python.exe setup_outlook.py
"""
import json
from pathlib import Path

from checks.browser import looks_like_outlook_login, outlook_page

ROOT = Path(__file__).resolve().parent


def main():
    cfg = json.loads((ROOT / "config.json").read_text(encoding="utf-8")) \
        if (ROOT / "config.json").exists() else {}
    profile = ROOT / cfg.get("outlook_profile_dir", "profiles/outlook")
    url = cfg.get("outlook_url", "https://outlook.office.com/mail/")

    print(f"Opening Outlook web in the autopilot profile ({profile}).")
    print("Sign in as hunter.tubb@davies-services.com, approve MFA, and tick "
          "'Stay signed in'. When you can see the inbox, come back here.\n")
    with outlook_page(profile) as page:
        page.goto(url, wait_until="domcontentloaded")
        input("Press Enter once the inbox is visible... ")
        page.wait_for_timeout(2000)
        if looks_like_outlook_login(page):
            print("\n[!] Still looks like a login page — the session may not "
                  "have stuck. Re-run this and make sure 'Stay signed in' is "
                  "ticked.")
            return 1
    print("\n[OK] Outlook profile is signed in. Runs will reuse it until the "
          "session expires (the digest will say so when it does).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
