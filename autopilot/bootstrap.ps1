# Crest Autopilot — guided setup on the laptop. Walks build-checklist steps
# 2-6 in order and pauses wherever Hunter has to click something.
#
#   cd C:\autopilot
#   powershell -ExecutionPolicy Bypass -File bootstrap.ps1

$ErrorActionPreference = "Stop"
$root = "C:\autopilot"
if ((Get-Location).Path -ne $root) {
    if (Test-Path "$root\bootstrap.ps1") { Set-Location $root }
    else { throw "Copy this folder to C:\autopilot first (README step 1), then run from there." }
}
$py = "$root\venv\Scripts\python.exe"

Write-Host "`n=== Crest Autopilot setup ===`n"

# -- Step 1: decommission gate ------------------------------------------------
Write-Host "Gate: Nate must be fully decommissioned (DECOMMISSION.md in the"
Write-Host "nate-system archive) - Vultr server destroyed, services removed."
Write-Host "Two robots must never touch AUSUM at the same time."
$ok = Read-Host "Is the decommission checklist complete? (yes/no)"
if ($ok -ne "yes") { Write-Host "Finish DECOMMISSION.md first, then re-run this."; exit 1 }

# -- Step 2: python env --------------------------------------------------------
if (-not (Test-Path $py)) {
    Write-Host "`nCreating venv + installing dependencies..."
    python -m venv venv
    & $py -m pip install --quiet --upgrade pip
    & $py -m pip install --quiet -r requirements.txt
    & $py -m playwright install chromium
} else { Write-Host "`nvenv already present - skipping install." }

if (-not (Test-Path "$root\config.json")) {
    Copy-Item "$root\config.example.json" "$root\config.json"
    Write-Host "Created config.json from the example."
}

# -- Claude CLI ----------------------------------------------------------------
try {
    $cv = (& claude --version) 2>$null
    Write-Host "Claude Code found: $cv"
} catch {
    Write-Host "[!] 'claude' not on PATH. Install Claude Code and run 'claude'"
    Write-Host "    once interactively to sign in as Hunter, then re-run this."
    exit 1
}

# -- Step 3: Outlook profile ----------------------------------------------------
Write-Host "`n--- Outlook web profile ---"
Write-Host "A browser will open on the dedicated profile. Sign in as"
Write-Host "hunter.tubb@davies-services.com and tick 'Stay signed in'."
Read-Host "Press Enter to open it"
& $py setup_outlook.py
if ($LASTEXITCODE -ne 0) { Write-Host "Outlook profile setup didn't stick - re-run bootstrap."; exit 1 }

# -- Step 4: digest delivery ----------------------------------------------------
Write-Host "`n--- Digest delivery ---"
Write-Host "  1) Gmail API as Hunter (preferred; needs secrets\oauth_client.json - README)"
Write-Host "  2) Synced folder the Mac can see (fallback)"
$choice = Read-Host "Pick 1 or 2"
$cfg = Get-Content "$root\config.json" -Raw | ConvertFrom-Json
if ($choice -eq "1") {
    if (-not (Test-Path "$root\secrets\oauth_client.json")) {
        Write-Host "[!] secrets\oauth_client.json missing. Create the Desktop-app"
        Write-Host "    OAuth client in Hunter's own Google Cloud project (README ->"
        Write-Host "    'Gmail delivery'), save the JSON there, and re-run bootstrap."
        exit 1
    }
    & $py gmail_consent.py
    if ($LASTEXITCODE -ne 0) { exit 1 }
    $cfg.delivery = "gmail"
} else {
    $folder = Read-Host "Full path of the cloud-synced folder (e.g. G:\My Drive\autopilot-digests)"
    $cfg.delivery = "folder"
    $cfg.synced_folder = $folder
}
$cfg | ConvertTo-Json -Depth 5 | Set-Content "$root\config.json" -Encoding UTF8

# -- Step 5: dry run -------------------------------------------------------------
Write-Host "`n--- Dry run (prints the digest instead of sending) ---"
Write-Host "Make sure the AUSUM Chrome is up (launch_ausum_chrome_as_admin.bat)."
Read-Host "Press Enter to run"
& $py run.py --dry-run
if ($LASTEXITCODE -ne 0) { Write-Host "[!] Dry run failed - fix before scheduling (logs above)."; exit 1 }

# -- Step 6: Task Scheduler -------------------------------------------------------
Write-Host "`n--- Task Scheduler (8:00 / 12:00 / 16:00 Mon-Fri) ---"
Write-Host "This needs elevation; a UAC prompt will appear."
Read-Host "Press Enter to register"
Start-Process powershell -Verb RunAs -Wait -ArgumentList `
    "-ExecutionPolicy","Bypass","-File","$root\register_tasks.ps1"

Write-Host "`n=== Done. Watch mode starts now (build checklist step 7): ==="
Write-Host "For one week, compare every digest against AUSUM/Outlook yourself."
Write-Host "Raw material for each run is under runs\<timestamp>\. Silence from"
Write-Host "a run means it found no changes."
