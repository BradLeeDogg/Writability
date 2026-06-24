import anthropic

from .memory import Memory
from .tools import TOOL_SCHEMAS, TOOLS

MODEL = "claude-opus-4-8"
MAX_TOKENS = 16000

SYSTEM_PROMPT = (
    "You are a general-purpose agent with access to tools for reading and "
    "writing files, running shell commands, and doing arithmetic. Use tools "
    "when they help you complete the user's request accurately; otherwise "
    "just answer directly."
)


def _execute_tool(name: str, tool_input: dict) -> tuple[str, bool]:
    handler = TOOLS.get(name)
    if handler is None:
        return f"Error: unknown tool '{name}'", True
    try:
        return handler(**tool_input), False
    except Exception as exc:  # tool implementations are arbitrary; surface any failure to Claude
        return f"Error running '{name}': {exc}", True


def _stream_turn(client: anthropic.Anthropic, messages: list[dict]) -> anthropic.types.Message:
    with client.messages.stream(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        thinking={"type": "adaptive"},
        tools=TOOL_SCHEMAS,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
        final = stream.get_final_message()
    print()
    return final


def run_turn(client: anthropic.Anthropic, memory: Memory, user_input: str) -> str:
    """Run one user turn through the agent loop until Claude stops calling tools."""
    memory.append({"role": "user", "content": user_input})

    while True:
        response = _stream_turn(client, memory.messages)
        content = [block.model_dump(mode="json") for block in response.content]
        memory.append({"role": "assistant", "content": content})

        if response.stop_reason != "tool_use":
            break

        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            result, is_error = _execute_tool(block.name, block.input)
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                    "is_error": is_error,
                }
            )
        memory.append({"role": "user", "content": tool_results})

    return next((b.text for b in response.content if b.type == "text"), "")
