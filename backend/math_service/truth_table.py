"""Truth table generator — DETERMINISTIC, no LLM calls.

Boolean expressions are evaluated with a small recursive-descent parser rather
than string substitution + eval. The previous substitution approach corrupted
operator keywords (e.g. replacing variable ``A`` inside ``AND``), which made
every row evaluate to False. The parser below tokenizes on word boundaries so
variables and operators never collide, and it never calls eval().
"""
import re
from itertools import product
from pydantic import BaseModel

# Operator keywords, longest first so NAND/NOR/XNOR are matched before AND/OR.
_OPERATORS = ("XNOR", "XOR", "NAND", "NOR", "AND", "OR", "NOT")
_TOKEN_RE = re.compile(r"\s*([A-Za-z_][A-Za-z_0-9]*|\(|\))")


class TruthTableRequest(BaseModel):
    expression: str  # e.g. "A AND B OR NOT C"
    variables: list[str]  # e.g. ["A", "B", "C"]


def _tokenize(expr: str) -> list[str]:
    tokens: list[str] = []
    pos = 0
    while pos < len(expr):
        match = _TOKEN_RE.match(expr, pos)
        if not match:
            # Skip any unrecognized character (e.g. stray punctuation).
            pos += 1
            continue
        tokens.append(match.group(1).upper())
        pos = match.end()
    return tokens


class _Parser:
    """Recursive-descent evaluator.

    Precedence (lowest to highest): OR/NOR < XOR/XNOR < AND/NAND < NOT < atom.
    Binary operators are left-associative.
    """

    def __init__(self, tokens: list[str], values: dict[str, bool]):
        self._tokens = tokens
        self._pos = 0
        self._values = {k.upper(): v for k, v in values.items()}

    def _peek(self) -> str | None:
        return self._tokens[self._pos] if self._pos < len(self._tokens) else None

    def _next(self) -> str | None:
        tok = self._peek()
        if tok is not None:
            self._pos += 1
        return tok

    def parse(self) -> bool:
        result = self._parse_or()
        return result

    def _parse_or(self) -> bool:
        left = self._parse_xor()
        while self._peek() in ("OR", "NOR"):
            op = self._next()
            right = self._parse_xor()
            combined = left or right
            left = (not combined) if op == "NOR" else combined
        return left

    def _parse_xor(self) -> bool:
        left = self._parse_and()
        while self._peek() in ("XOR", "XNOR"):
            op = self._next()
            right = self._parse_and()
            left = (left == right) if op == "XNOR" else (left != right)
        return left

    def _parse_and(self) -> bool:
        left = self._parse_not()
        while self._peek() in ("AND", "NAND"):
            op = self._next()
            right = self._parse_not()
            combined = left and right
            left = (not combined) if op == "NAND" else combined
        return left

    def _parse_not(self) -> bool:
        if self._peek() == "NOT":
            self._next()
            return not self._parse_not()
        return self._parse_atom()

    def _parse_atom(self) -> bool:
        tok = self._next()
        if tok == "(":
            value = self._parse_or()
            if self._peek() == ")":
                self._next()
            return value
        if tok in ("1", "TRUE"):
            return True
        if tok in ("0", "FALSE", None):
            return False
        # Treat any remaining identifier as a variable; unknown vars default False.
        return self._values.get(tok, False)


def _evaluate(expr: str, values: dict[str, bool]) -> bool:
    tokens = _tokenize(expr)
    if not tokens:
        return False
    return _Parser(tokens, values).parse()


def generate_truth_table(req: TruthTableRequest) -> dict:
    variables = req.variables
    n = len(variables)
    rows = []
    outputs = []

    for combo in product([False, True], repeat=n):
        values = dict(zip(variables, combo))
        output = _evaluate(req.expression, values)
        rows.append(list(combo))
        outputs.append(output)

    return {
        "variables": variables,
        "rows": rows,
        "outputs": outputs,
    }
