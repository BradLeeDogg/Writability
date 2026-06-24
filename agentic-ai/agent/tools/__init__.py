from typing import Callable, Dict

from .calculator import CALCULATE_SCHEMA, calculate
from .files import READ_FILE_SCHEMA, WRITE_FILE_SCHEMA, read_file, write_file
from .shell import RUN_SHELL_SCHEMA, run_shell

TOOL_SCHEMAS = [
    READ_FILE_SCHEMA,
    WRITE_FILE_SCHEMA,
    RUN_SHELL_SCHEMA,
    CALCULATE_SCHEMA,
]

TOOLS: Dict[str, Callable[..., str]] = {
    "read_file": read_file,
    "write_file": write_file,
    "run_shell": run_shell,
    "calculate": calculate,
}
