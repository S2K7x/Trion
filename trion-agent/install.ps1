$AgentDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── Python version check ──────────────────────────────────────────────────────
$PythonCmd = $null
foreach ($candidate in @("python3", "python")) {
    $found = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($found) {
        $ver = & $found.Source -c "import sys; print(sys.version_info >= (3,11))"
        if ($ver -eq "True") {
            $PythonCmd = $found.Source
            break
        }
    }
}

if (-not $PythonCmd) {
    Write-Error "[trion-agent] ERROR: Python 3.11 or newer is required."
    Write-Error "  Install it from https://python.org"
    exit 1
}

Write-Host "[trion-agent] Using $(& $PythonCmd --version)"

# ── Dependencies ──────────────────────────────────────────────────────────────
Write-Host "[trion-agent] Installing dependencies..."
& $PythonCmd -m pip install -r requirements.txt

# ── Config ────────────────────────────────────────────────────────────────────
Write-Host "[trion-agent] Setting up config..."
if (-not (Test-Path "config.toml")) {
    Copy-Item "config.toml.example" "config.toml"
    icacls "config.toml" /inheritance:r /grant:r "$env:USERNAME:F"
    Write-Host "[trion-agent] Edit config.toml before first run."
}

New-Item -ItemType Directory -Force -Path "data\snapshots" | Out-Null
icacls "data" /inheritance:r /grant:r "$env:USERNAME:F"

# ── Scheduler ─────────────────────────────────────────────────────────────────
Write-Host "[trion-agent] Registering scheduled task..."
$Action = New-ScheduledTaskAction -Execute $PythonCmd -Argument "agent.py" -WorkingDirectory $AgentDir
$Trigger = New-ScheduledTaskTrigger -Daily -At "07:00"
$Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1)

# RunLevel Limited (default) — agent only needs read access to system state.
# Do NOT use RunLevel Highest; that grants unnecessary Administrator privileges.
Register-ScheduledTask `
    -TaskName "TrionAgent" `
    -Description "Trion daily host drift detection" `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Force

Write-Host "[trion-agent] Done. Run '& $PythonCmd agent.py --run-now' to test immediately."
