from pathlib import Path

READ_FILE_SCHEMA = {
    "name": "read_file",
    "description": "Read the full contents of a text file at the given path.",
    "input_schema": {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Path to the file to read."},
        },
        "required": ["path"],
    },
}

WRITE_FILE_SCHEMA = {
    "name": "write_file",
    "description": "Write text content to a file at the given path, creating it "
    "(and parent directories) if needed, or overwriting it if it exists.",
    "input_schema": {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Path to the file to write."},
            "content": {"type": "string", "description": "Text content to write."},
        },
        "required": ["path", "content"],
    },
}


def read_file(path: str) -> str:
    try:
        return Path(path).read_text()
    except OSError as exc:
        return f"Error reading {path}: {exc}"


def write_file(path: str, content: str) -> str:
    try:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
        return f"Wrote {len(content)} characters to {path}"
    except OSError as exc:
        return f"Error writing {path}: {exc}"
