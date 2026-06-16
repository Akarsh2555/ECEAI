"""LLM-backed HDL synthesis.

The deterministic `netlist_to_verilog` is *structural* — it transcribes the
exact wiring on the canvas pin-for-pin. That is faithful, but it is not the
clean, parameterized, industry-style RTL an engineer would actually write (a
ripple counter, for instance, comes out as literal D<=IN stages rather than the
idiomatic toggle counter).

This module asks the LLM to produce production-grade, synthesizable HDL, grounded
in the *deterministic* topology analysis (so it gets the behaviour right) plus
the structural netlist (so it gets the ports/connectivity right) and, when
available, the user's natural-language intent. If the LLM is unavailable (no
key, quota exhausted, timeout) it returns the structural HDL unchanged — the
feature degrades gracefully and never blocks.
"""
import re

from ._llm import invoke_text

_FENCE = re.compile(r"^\s*```[a-zA-Z]*\s*\n?|\n?```\s*$")


def _strip_code_fences(text: str) -> str:
    """Remove surrounding ```verilog ... ``` markdown fences the model may add."""
    t = text.strip()
    if "```" in t:
        # Prefer the content of the first fenced block if present.
        m = re.search(r"```[a-zA-Z]*\s*\n(.*?)```", t, re.DOTALL)
        if m:
            return m.group(1).strip()
        t = _FENCE.sub("", t)
    return t.strip()


def _topology_brief(summary: dict) -> str:
    """One-paragraph plain description of the circuit from the deterministic analysis."""
    if not summary:
        return "Combinational/sequential logic (topology not classified)."
    if summary.get("kind") == "sequential":
        parts = [
            f"{summary.get('flip_flops', 0)} {'/'.join(summary.get('ff_types', []) or ['D'])}-type flip-flop(s)",
            f"clocking: {summary.get('clocking', 'unknown')}",
            f"topology: {summary.get('topology', 'state machine')}",
        ]
        if summary.get("gate_count"):
            parts.append(f"{summary['gate_count']} gate(s)")
        if summary.get("inputs"):
            parts.append(f"inputs {summary['inputs']}")
        if summary.get("outputs"):
            parts.append(f"outputs {summary['outputs']}")
        return "Sequential circuit — " + "; ".join(parts) + "."
    parts = [f"{summary.get('gate_count', 0)} gate(s)"]
    if summary.get("inputs"):
        parts.append(f"inputs {summary['inputs']}")
    if summary.get("outputs"):
        parts.append(f"outputs {summary['outputs']}")
    return "Combinational circuit — " + "; ".join(parts) + "."


def _looks_like_verilog(text: str) -> bool:
    t = text.lower()
    return "module" in t and "endmodule" in t


def generate_industry_hdl(
    structural_hdl: str,
    summary: dict | None = None,
    intent: str | None = None,
    language: str = "verilog",
    timeout: float = 12.0,
) -> dict:
    """Return {"hdl", "language", "source"} where source is 'llm' or 'structural'.

    Falls back to the structural HDL whenever the LLM is unavailable or returns
    something that doesn't look like valid HDL."""
    from langchain_core.messages import SystemMessage, HumanMessage

    lang_name = "VHDL" if language == "vhdl" else "Verilog-2001"
    brief = _topology_brief(summary or {})

    system = (
        f"You are a senior RTL design engineer. Output ONLY synthesizable {lang_name} "
        "source code — no prose, no Markdown, no code fences, no explanation. "
        "Follow industry conventions: a single self-contained module named `circuit`, "
        "parameterize bit widths where natural, use non-blocking assignments in clocked "
        "blocks, give every flip-flop an asynchronous active-high reset (and preset where "
        "the design uses one), label clock edges explicitly, and add concise inline comments. "
        "The code must compile with a standard simulator (Icarus/ModelSim)."
    )
    human = (
        f"Deterministic analysis of the circuit on the canvas:\n{brief}\n\n"
        "Structural netlist (exact pin-level wiring, authoritative for ports and connectivity):\n"
        f"{structural_hdl}\n\n"
        + (f"The user described their intent as: \"{intent}\".\n\n" if intent else "")
        + f"Write clean, industry-standard {lang_name} that implements this circuit. "
        "Keep the module's input/output port names from the structural netlist.\n"
        "- If the user's intent (or the deterministic analysis) names a STANDARD building block "
        "— e.g. an asynchronous/ripple counter, synchronous counter, Johnson/ring counter, or "
        "shift register — implement the IDIOMATIC, fully-working RTL for that block, even if the "
        "structural transcription is incomplete or mis-wired (for example, a real ripple counter "
        "toggles each stage from its own Q, i.e. Q <= ~Q, and ripple-clocks each stage from the "
        "previous stage's output — do NOT copy a literal Q <= IN if the intent is a counter).\n"
        "- Otherwise, faithfully implement the behaviour described by the structural netlist."
    )

    text = invoke_text([SystemMessage(content=system), HumanMessage(content=human)], temperature=0.1, timeout=timeout)
    if not text:
        return {"hdl": structural_hdl, "language": language, "source": "structural"}
    code = _strip_code_fences(text)
    if language == "verilog" and not _looks_like_verilog(code):
        return {"hdl": structural_hdl, "language": language, "source": "structural"}
    return {"hdl": code, "language": language, "source": "llm"}
