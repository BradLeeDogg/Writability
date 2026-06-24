import json
from pathlib import Path
from typing import Any, Dict, List


class Memory:
    """Conversation history, kept in process and optionally persisted to disk."""

    def __init__(self, path: str | None = None) -> None:
        self.path = Path(path) if path else None
        self.messages: List[Dict[str, Any]] = []
        if self.path and self.path.exists():
            self.messages = json.loads(self.path.read_text())

    def append(self, message: Dict[str, Any]) -> None:
        self.messages.append(message)
        self._persist()

    def _persist(self) -> None:
        if self.path:
            self.path.write_text(json.dumps(self.messages, indent=2))
