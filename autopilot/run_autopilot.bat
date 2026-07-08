@echo off
REM Crest Autopilot — Task Scheduler entry point. One attempt, no retries
REM (and none configured on the scheduled task either). Output accumulates
REM in logs\runs.log; per-run material lands in runs\<timestamp>\.
cd /d C:\autopilot
if not exist logs mkdir logs
echo ---- %date% %time% ---- >> logs\runs.log
venv\Scripts\python.exe run.py >> logs\runs.log 2>&1
exit /b %errorlevel%
