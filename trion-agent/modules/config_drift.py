"""Config drift module — tracks open ports, services, users, cron, sudoers."""

COMMANDS = {
    "linux": [
        "ss -tlnp",
        "systemctl list-units --state=running --no-pager",
        "cat /etc/passwd",
        "cat /etc/sudoers",
        "crontab -l",
        "ls -la /etc/cron.d/",
    ],
    "macos": [
        "netstat -an | grep LISTEN",
        "launchctl list",
        "cat /etc/passwd",
        "crontab -l",
        "ls -la ~/Library/LaunchAgents/",
        "ls -la /Library/LaunchAgents/",
        "ls -la /Library/LaunchDaemons/",
    ],
    "windows": [
        "netstat -ano | findstr LISTENING",
        "Get-Service | Where-Object {$_.Status -eq 'Running'} | Select-Object Name,DisplayName | Format-List",
        "Get-LocalUser | Select-Object Name,Enabled,LastLogon | Format-List",
        "Get-ScheduledTask | Where-Object {$_.State -eq 'Ready'} | Select-Object TaskName,TaskPath | Format-List",
        "Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'",
    ],
}


def get_commands(os_type: str, custom_commands: list[str]) -> list[str]:
    """Return custom_commands if provided, otherwise the built-in list for os_type."""
    if custom_commands:
        return custom_commands
    return COMMANDS.get(os_type, COMMANDS["linux"])
