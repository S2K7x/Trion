"""Collect command output snapshots from the host system."""
import logging
import subprocess

logger = logging.getLogger(__name__)

# Shell metacharacters that are dangerous in custom (user-provided) commands.
# Includes redirection operators and whitespace injection vectors.
_DANGEROUS_CHARS = frozenset({
    ";", "&", "|", "`", "$", "(", ")", "{", "}",
    ">", "<", "!",          # redirection / history expansion
    "\n", "\r",             # newline injection (TOML parses \n in strings)
})


def validate_command(cmd: str) -> bool:
    """Return True if the command contains no shell injection characters."""
    return not any(c in cmd for c in _DANGEROUS_CHARS)


def collect(
    module_name: str,
    commands: list[str],
    os_type: str,
    validate: bool = False,
) -> dict[str, str]:
    """Run each command and return a dict mapping command → stdout output.

    If validate=True, user-provided commands containing shell metacharacters are
    skipped with a WARNING rather than executed.
    """
    logger.info("Running %d commands for module %s", len(commands), module_name)
    results = {}
    for cmd in commands:
        if validate and not validate_command(cmd):
            logger.warning(
                "Custom command rejected (shell injection risk): %s", cmd
            )
            results[cmd] = ""
            continue

        try:
            if os_type == "windows":
                proc = subprocess.run(
                    ["powershell", "-Command", cmd],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
            else:
                proc = subprocess.run(
                    cmd,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
            if proc.returncode != 0 and proc.stderr:
                logger.warning(
                    "Command exited %d: %s — %s",
                    proc.returncode,
                    cmd,
                    proc.stderr.strip(),
                )
            results[cmd] = proc.stdout
        except subprocess.TimeoutExpired:
            logger.error("Command timed out: %s", cmd)
            results[cmd] = ""
        except Exception as exc:
            logger.error("Command failed: %s — %s", cmd, exc)
            results[cmd] = ""
    return results
