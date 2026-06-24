# agentic-ai

A minimal, generic agent loop built on the Claude API: model calls, tool use,
and conversation memory, with no task-specific assumptions baked in. Meant
as a starting point to specialize toward whatever task you point it at.

## Setup

```bash
cd agentic-ai
python -m venv .venv && source .venv/bin/activate
pip install -e .
export ANTHROPIC_API_KEY=sk-ant-...
```

## Run

```bash
agent                  # interactive chat loop
agent "list the files in the current directory"   # single instruction
```

## How it's structured

- `agent/loop.py` — the agentic loop itself: send messages, execute any
  tool calls Claude makes, feed results back, repeat until Claude stops
  calling tools.
- `agent/memory.py` — conversation history, kept in process memory and
  optionally persisted to a JSON file between runs.
- `agent/tools/` — tool definitions. Each tool is a small Python function
  plus a JSON schema describing it to Claude. Add new tools here and
  register them in `agent/tools/__init__.py`.
- `agent/cli.py` — entry point for interactive and single-shot use.

## Adding a tool

1. Write a function in `agent/tools/` that takes keyword arguments matching
   your JSON schema's `input_schema.properties` and returns a string result.
2. Add the JSON schema (name, description, input_schema) next to it.
3. Register both in `TOOLS` and `TOOL_SCHEMAS` in `agent/tools/__init__.py`.

The loop doesn't need to change — it dispatches on tool name generically.
