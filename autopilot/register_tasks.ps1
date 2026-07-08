# Registers the Crest Autopilot scheduled task: 8:00 / 12:00 / 16:00,
# Mon-Fri, one task with three triggers. Run only when Hunter is logged on
# (the checks drive a visible browser in his session), limited privileges,
# 30-minute execution cap, and — deliberately — zero restart-on-failure.
# The existing AUSUM Chrome launch task is untouched: keep it.
#
# Run from an elevated PowerShell:
#   powershell -ExecutionPolicy Bypass -File register_tasks.ps1

$ErrorActionPreference = "Stop"
$taskName = "CrestAutopilot"
$batPath = "C:\autopilot\run_autopilot.bat"

if (-not (Test-Path $batPath)) {
    throw "$batPath not found - copy the autopilot folder to C:\autopilot first."
}

$action = New-ScheduledTaskAction -Execute $batPath -WorkingDirectory "C:\autopilot"
$days = @("Monday","Tuesday","Wednesday","Thursday","Friday")
$triggers = @(
    New-ScheduledTaskTrigger -Weekly -DaysOfWeek $days -At 08:00
    New-ScheduledTaskTrigger -Weekly -DaysOfWeek $days -At 12:00
    New-ScheduledTaskTrigger -Weekly -DaysOfWeek $days -At 16:00
)
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -DontStopOnIdleEnd `
    -StartWhenAvailable:$false `
    -MultipleInstances IgnoreNew
# InteractiveToken = run only when the user is logged on, no stored password.
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME `
    -LogonType Interactive -RunLevel Limited

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers `
    -Settings $settings -Principal $principal `
    -Description "Read-only AUSUM + Outlook digest to hunter@atlascrestllc.com. No retries by design." | Out-Null

Write-Host "[OK] Task '$taskName' registered: 8:00 / 12:00 / 16:00 Mon-Fri."
Write-Host "     Reminder: the AUSUM Chrome launch task stays as-is."
