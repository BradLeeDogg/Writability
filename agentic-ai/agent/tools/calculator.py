import ast
import operator

CALCULATE_SCHEMA = {
    "name": "calculate",
    "description": "Evaluate a numeric arithmetic expression (e.g. '2 * (3 + 4) / 7') "
    "and return the result. Supports +, -, *, /, //, %, **, and parentheses.",
    "input_schema": {
        "type": "object",
        "properties": {
            "expression": {"type": "string", "description": "Arithmetic expression."},
        },
        "required": ["expression"],
    },
}

_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def _eval(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _OPERATORS:
        return _OPERATORS[type(node.op)](_eval(node.left), _eval(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPERATORS:
        return _OPERATORS[type(node.op)](_eval(node.operand))
    raise ValueError(f"Unsupported expression: {ast.dump(node)}")


def calculate(expression: str) -> str:
    try:
        tree = ast.parse(expression, mode="eval")
        return str(_eval(tree.body))
    except (SyntaxError, ValueError, ZeroDivisionError, TypeError) as exc:
        return f"Error evaluating '{expression}': {exc}"
