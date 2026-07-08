# Crest Autopilot

Read-only watcher for AUSUM and Outlook web. Three times a weekday it looks at
both sites, compares against what it saw last run, and emails
`hunter@atlascrestllc.com` a short plain-English digest of what changed.
It never acts on anything. Spec: `AUTOPILOT.md` in the (archived)
`nate-system` repo.

## Hard rules

1. **Read-only.** No emails to insureds, no AUSUM notes, no scheduling, no
   calls, no CAS. If a run sees something that needs fixing, it says so in
   the digest — nothing else.
2. **One outbound channel:** the digest to Hunter (Gmail API send-only, or a
   file in a synced folder). Enforced in code — `delivery.py` is the only
   module that sends anything, and the Gmail token holds only the
   `gmail.send` scope.
3. **Hard-capped.** 3 scheduled runs per weekday, one attempt per run, a
   per-run deadline and a per-run cap on Claude calls. A failed run sends a
   one-line failure digest and stops. No retry loops anywhere.
4. **MFA is never automated.** Login page on either site → the run stops and
   the digest says "session expired — tap the laptop and log in."
5. **No always-on process.** Task Scheduler fires a run; the run ends; the
   machine is idle again. (The persistent AUSUM Chrome is the one existing
   exception, kept as-is from the old setup.)

The same rules are baked into `CLAUDE.md` (read by every `claude -p` call
this project makes) and enforced by `.claude/settings.json`, which denies
Claude everything except reading files under `runs/`.

## How a run works

```
Task Scheduler (8:00 / 12:00 / 16:00, Mon–Fri)
  └─ run_autopilot.bat → python run.py        (one attempt, deadline-capped)
       ├─ AUSUM check    — attach to the persistent AUSUM Chrome (CDP :9222),
       │                   walk the picked/assigned/pastdue/returned/entered
       │                   lists, open details for attach counts, screenshot
       │                   Returned audits for reviewer notes
       ├─ Outlook check  — open the dedicated Outlook Chrome profile
       │                   (profiles/outlook), read the inbox list, close it
       ├─ Delta          — compare against state.json from last run
       └─ Digest         — claude -p writes the plain-English summary
                           (deterministic fallback if Claude is unavailable),
                           delivery.py sends it. "Nothing changed" runs send
                           nothing at all.
```

Reviewer notes on Returned audits are extracted verbatim from detail-page
screenshots by a read-only `claude -p` call.

## Setup on the laptop (build checklist steps 2–6)

Prereqs already on the machine: Python 3.11+, the persistent AUSUM Chrome
(`C:\nate-system\scripts\launch_ausum_chrome_as_admin.bat` — keep using it
and its scheduled task as-is), and Claude Code (`claude` on PATH, logged in
as Hunter — run `claude` once interactively to sign in; no API key on disk).

1. Copy this `autopilot/` folder to `C:\autopilot` and make it its own repo:

   ```powershell
   git clone https://github.com/huntertubb1/atlas-crest C:\autopilot-src
   Copy-Item -Recurse C:\autopilot-src\autopilot C:\autopilot
   cd C:\autopilot; git init; git add -A; git commit -m "Crest Autopilot v1"
   ```

2. Run the guided setup (it walks every remaining step and pauses where
   Hunter has to click something):

   ```powershell
   cd C:\autopilot
   powershell -ExecutionPolicy Bypass -File bootstrap.ps1
   ```

   It will, in order: confirm the Nate decommission is done → create the
   venv and install deps → open the Outlook Chrome profile so Hunter can log
   in once with **"Stay signed in"** → set up digest delivery (Gmail OAuth
   consent as Hunter, or a synced-folder path) → do a `--dry-run` that
   prints the digest instead of sending → register the Task Scheduler
   entries.

### Gmail delivery (preferred)

Needs a one-time OAuth client under **Hunter's own** Google account (not
anything of Nate's — those credentials are cancelled and must stay dead):

1. console.cloud.google.com → new project (e.g. "crest-autopilot") →
   APIs & Services → Enable **Gmail API**.
2. OAuth consent screen → Internal (or External + Hunter as test user).
3. Credentials → Create credentials → OAuth client ID → **Desktop app** →
   download the JSON to `C:\autopilot\secrets\oauth_client.json`.
4. `bootstrap.ps1` (or `venv\Scripts\python.exe gmail_consent.py`) opens the
   consent page — approve as hunter@atlascrestllc.com. The token it stores
   can **only send** mail (`gmail.send`), never read it.

If that's more Google-console than the day allows, pick the folder fallback
in bootstrap instead: digests get written to a Drive/iCloud-synced folder
the Mac can see. Switch to Gmail later by re-running bootstrap.

## Watch mode (build checklist step 7)

For the first week, Hunter double-checks every digest against AUSUM and
Outlook himself. Every digest and its raw material is kept under
`runs/<timestamp>/` — when the digest missed something, that folder shows
whether the scrape missed it or the summary dropped it. Fix, re-run
`run.py --dry-run`, repeat. Only after a clean week does the double-checking
stop.

## Day-to-day

- **Silence means all quiet.** No digest = the run found no changes.
  (The Task Scheduler history and `logs\runs.log` prove runs happened.)
- **"Session expired" digest** → open the laptop, log in on the named site
  (AUSUM Chrome window, or the Outlook profile via
  `venv\Scripts\python.exe setup_outlook.py`), done. Next run resumes.
- **"Run failed" digest** → look at `logs\runs.log` and the latest `runs\`
  folder. There are deliberately no retries; nothing else happened.
- Manual run any time: `venv\Scripts\python.exe run.py` (add `--dry-run` to
  print instead of send).

## Out of scope (v1)

Acting on anything, a Mac→laptop task channel, weekend runs, SMS,
dashboards, approval queues. Additions happen one at a time, each with its
own explicit go-ahead from Hunter, after watch mode has earned trust.
