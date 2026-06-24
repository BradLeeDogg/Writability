import subprocess

RUN_SHELL_SCHEMA = {
    "name": "run_shell",
    "description": "Run a shell command and return its combined stdout/stderr. "
    "Use for local, read-mostly operations like listing files or checking "
    "versions. Runs with a timeout and no special privileges.",
    "input_schema": {
        "type": "object",
        "properties": {
            "command": {"type": "string", "description": "Shell command to run."},
        },
        "required": ["command"],
    },
}


def run_shell(command: str, timeout: int = 30) -> str:
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = result.stdout + result.stderr
        return output.strip() or f"(command exited with code {result.returncode}, no output)"
    except subprocess.TimeoutExpired:
        return f"Error: command timed out after {timeout}s"
