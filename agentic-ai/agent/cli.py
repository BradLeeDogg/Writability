import sys

import anthropic

from .loop import run_turn
from .memory import Memory

HISTORY_PATH = ".agent_history.json"


def main() -> None:
    try:
        client = anthropic.Anthropic()
    except anthropic.AnthropicError as exc:
        print(f"Could not initialize Anthropic client: {exc}", file=sys.stderr)
        sys.exit(1)

    memory = Memory(HISTORY_PATH)

    if len(sys.argv) > 1:
        instruction = " ".join(sys.argv[1:])
        _run_safely(client, memory, instruction)
        return

    print("agentic-ai — minimal agent loop. Type 'exit' to quit.")
    while True:
        try:
            user_input = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not user_input:
            continue
        if user_input.lower() in {"exit", "quit"}:
            break
        _run_safely(client, memory, user_input)


def _run_safely(client: anthropic.Anthropic, memory: Memory, instruction: str) -> None:
    try:
        run_turn(client, memory, instruction)
    except anthropic.APIStatusError as exc:
        print(f"\nAPI error ({exc.status_code}): {exc.message}", file=sys.stderr)
    except anthropic.APIConnectionError as exc:
        print(f"\nConnection error: {exc}", file=sys.stderr)


if __name__ == "__main__":
    main()
