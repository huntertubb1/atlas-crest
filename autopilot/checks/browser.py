"""Shared browser plumbing: attach to the persistent AUSUM Chrome over CDP,
open the dedicated Outlook profile, detect login pages.

AUSUM Chrome is the one launched by C:\\nate-system\\scripts\\
launch_ausum_chrome_as_admin.bat (kept from the old setup). We attach to it
on CDP :9222 and open our own tab, so Hunter's tabs are never navigated,
and we only disconnect at the end — Chrome itself keeps running with his
session intact.

Outlook gets no always-on Chrome: a persistent *profile* directory holds
the "Stay signed in" cookies, and each run launches a browser on it for a
minute and closes it again.
"""
import re
import urllib.request
from contextlib import contextmanager
from pathlib import Path

from playwright.sync_api import sync_playwright


class SessionExpired(Exception):
    """A login page where a logged-in page should be. The run reports it in
    the digest and stops — MFA is never automated (hard rule 4)."""

    def __init__(self, site: str, detail: str = ""):
        self.site = site
        super().__init__(f"{site} session expired{': ' + detail if detail else ''}")


class ChromeNotRunning(Exception):
    """The persistent AUSUM Chrome isn't listening on its CDP port."""


def cdp_alive(cdp_url: str, timeout: float = 3.0) -> bool:
    try:
        with urllib.request.urlopen(f"{cdp_url}/json/version", timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False


@contextmanager
def ausum_page(cdp_url: str):
    """Yield a fresh tab in the persistent AUSUM Chrome; close only that tab
    and the CDP connection on exit, never the browser."""
    if not cdp_alive(cdp_url):
        raise ChromeNotRunning(
            f"AUSUM Chrome not answering on {cdp_url} — "
            "run launch_ausum_chrome_as_admin.bat on the laptop"
        )
    with sync_playwright() as pw:
        browser = pw.chromium.connect_over_cdp(cdp_url)
        context = browser.contexts[0] if browser.contexts else browser.new_context()
        page = context.new_page()
        page.set_default_timeout(20_000)
        try:
            yield page
        finally:
            try:
                page.close()
            except Exception:
                pass
            browser.close()  # disconnects from CDP; the browser keeps running


@contextmanager
def outlook_page(profile_dir: Path):
    """Yield a page in a headed Chromium on the dedicated Outlook profile.
    login_mode setup is in setup_outlook.py; here the profile must already
    hold a "Stay signed in" session."""
    profile_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            str(profile_dir),
            headless=False,  # M365 is far less suspicious of a headed browser
            args=["--no-first-run", "--no-default-browser-check"],
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.set_default_timeout(30_000)
        try:
            yield page
        finally:
            context.close()


def looks_like_ausum_login(page) -> bool:
    """Cheap DOM/URL heuristics; checked before reading anything (the
    _login_if_needed lesson from nate-system). No vision needed for the
    login page itself — a password field is unambiguous."""
    url = (page.url or "").lower()
    if "login" in url or url.rstrip("/").endswith("index.cfm"):
        return True
    try:
        return page.locator('input[type="password"]').count() > 0
    except Exception:
        return False


def looks_like_outlook_login(page) -> bool:
    url = (page.url or "").lower()
    if re.search(r"login\.microsoftonline\.com|login\.live\.com|login\.microsoft\.com", url):
        return True
    try:
        return page.locator('input[type="password"], input[name="loginfmt"]').count() > 0
    except Exception:
        return False


def wait_for_content(page, ms: int = 8000):
    """Wait for the DOM to settle without ever using networkidle — AUSUM's
    keep-alive heartbeats mean networkidle never fires (2026-05-13 incident
    in nate-system)."""
    try:
        page.wait_for_load_state("domcontentloaded", timeout=ms)
    except Exception:
        pass
    page.wait_for_timeout(1500)
