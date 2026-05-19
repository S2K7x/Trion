$AgentDir = (Get-Location).Path

Write-Host "[trion-agent] Installing dependencies..."
pip install -r requirements.txt

Write-Host "[trion-agent] Setting up config..."
if (-not (Test-Path "config.toml")) {
  Copy-Item "config.toml.example" "config.toml"
  icacls "config.toml" /inheritance:r /grant:r "$env:USERNAME:F"
  Write-Host "[trion-agent] Edit config.toml before first run."
}

New-Item -ItemType Directory -Force -Path "data\snapshots" | Out-Null
icacls "data" /inheritance:r /grant:r "$env:USERNAME:F"

Write-Host "[trion-agent] Registering scheduled task..."
$Action = New-ScheduledTaskAction -Execute "python" -Argument "agent.py" -WorkingDirectory $AgentDir
$Trigger = New-ScheduledTaskTrigger -Daily -At "07:00"
$Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask `
  -TaskName "TrionAgent" `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -RunLevel Highest `
  -Force

Write-Host "[trion-agent] Done. Run 'python agent.py --run-now' to test immediately."
