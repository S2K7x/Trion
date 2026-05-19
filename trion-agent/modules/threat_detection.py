"""Threat detection module — tracks logins, failed auth, SUID files, SSH keys."""

COMMANDS = {
    "linux": [
        "last -n 20",
        "grep 'Failed password' /var/log/auth.log | tail -30",
        "ps aux --sort=-%cpu | head -20",
        "find / -perm -4000 -type f 2>/dev/null",
        "ls -la ~/.ssh/",
    ],
    "macos": [
        "last -n 20",
        "log show --predicate 'eventMessage contains \"Failed\"' --last 1d | tail -30",
        "ps aux | sort -rk 3 | head -20",
        "find / -perm -4000 -type f 2>/dev/null",
        "ls -la ~/.ssh/",
    ],
    "windows": [
        "Get-EventLog -LogName Security -Newest 50 | Where-Object {$_.EventID -eq 4625} | Select-Object TimeGenerated,Message | Format-List",
        "Get-Process | Sort-Object CPU -Descending | Select-Object -First 20 Name,CPU,Id | Format-List",
        "Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'",
        "Get-ChildItem '$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup'",
    ],
}


def get_commands(os_type: str, custom_commands: list[str]) -> list[str]:
    """Return custom_commands if provided, otherwise the built-in list for os_type."""
    if custom_commands:
        return custom_commands
    return COMMANDS.get(os_type, COMMANDS["linux"])
