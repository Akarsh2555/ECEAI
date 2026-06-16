"""Digital logic analyzer node.

The truth table, timing diagram and minimized expression are ALWAYS derived
from the actual wiring via the deterministic netlist evaluator — never from an
LLM guess. (Previously, when the LLM was available, the truth table came from
the LLM's guessed boolean_expression, which could disagree with the real
circuit.) The LLM is used only for the conversational explanation, and it is
given the deterministic results so it explains them accurately.
"""
from langchain_core.messages import SystemMessage, HumanMessage
from ..state import GraphState
from ._llm import invoke_text


def _analyze_from_wiring(state: GraphState, nodes, edges) -> str:
    """Compute truth table + timing + minimization from the real netlist.
    Sets artifacts and returns a context string for the explanation."""
    from math_service.netlist_eval import analyze_digital, NetlistRequest
    res = analyze_digital(NetlistRequest(nodes=nodes, edges=edges))

    if res.get("truth_table"):
        state["artifacts"]["truth_table"] = res["truth_table"]
    if res.get("timing"):
        state["artifacts"]["timing_diagram"] = res["timing"]
    if res.get("hdl"):
        state["artifacts"]["hdl_code"] = res["hdl"]
        state["artifacts"]["hdl_language"] = res.get("hdl_language", "verilog")
    if res.get("suggestions"):
        state["suggestions"] = state.get("suggestions", []) + res["suggestions"]

    summ = res.get("summary", {})

    # Sequential circuit (flip-flops / clock): there is no static truth table —
    # describe it as a clocked state machine with a timing diagram.
    if res.get("sequential") or summ.get("kind") == "sequential":
        n_ff = summ.get("flip_flops", 0)
        types = "/".join(summ.get("ff_types", [])) or "D"
        ngates = summ.get("gate_count", 0)
        clocking = summ.get("clocking", "unknown")   # derived from the clk wiring
        topo = summ.get("topology", "state machine")  # derived from the data wiring
        if clocking == "asynchronous":
            clk_phrase = "asynchronous (ripple): each flip-flop is clocked by the previous stage's output, not a shared clock"
        elif clocking == "synchronous":
            clk_phrase = "synchronous: all flip-flops share the CLK"
        else:
            clk_phrase = "clocking unclear from the wiring"
        name = f"{clocking} {topo}" if clocking in ("asynchronous", "synchronous") else topo
        return (
            f"This is a {name}: {n_ff} {types}-type flip-flop(s)"
            + (f" plus {ngates} gate(s)" if ngates else "")
            + f". Clocking is {clk_phrase}. A static truth table doesn't apply, so a timing diagram "
            "of the clock and each flip-flop's Q output over the clock cycles was generated (Timing tab)."
        )

    minimized = (res.get("truth_table") or {}).get("minimizedExpression")
    parts = [f"{summ.get('gate_count', 0)} gate(s)"]
    if summ.get("inputs"):
        parts.append(f"inputs {summ['inputs']}")
    if summ.get("outputs"):
        parts.append(f"output(s) {summ['outputs']}")
    if minimized:
        parts.append(f"minimized output {minimized}")
    context = "Digital circuit (from its wiring): " + ", ".join(parts) + "."
    return context


def logic_analyzer(state: GraphState) -> GraphState:
    netlist = state.get("netlist", {})
    raw_input = str(state.get("raw_input", ""))
    nodes = netlist.get("nodes", [])
    edges = netlist.get("edges", [])
    component_types = sorted({n.get("data", {}).get("type", "?") for n in nodes})

    # 1) Truth table / timing / Verilog — always from the actual netlist.
    context = None
    try:
        context = _analyze_from_wiring(state, nodes, edges)
        state["history"].append({"node": "logic_analyzer", "message": f"Analyzed the circuit from its wiring. {context}"})
    except Exception as e:
        state["history"].append({
            "node": "logic_analyzer",
            "message": f"Analyzed {len(nodes)} digital components: {', '.join(component_types)} (analysis error: {e}).",
        })

    # 2) Conversational explanation only (time-boxed; never computes the table).
    explanation = invoke_text(
        [
            SystemMessage(content=(
                "You are an expert digital logic engineer replying to the user. Answer their "
                "request in plain conversational English — no Markdown, asterisks, headings, or "
                "LaTeX. Write equations in plain text like 'F = A AND B'. Use ONLY the deterministic "
                "facts provided; do NOT invent a different truth table or expression."
            )),
            HumanMessage(content=(
                f"User request: {raw_input}\nDeterministic analysis: {context or 'n/a'}\n"
                "In 2-4 sentences, answer the user and explain what the circuit does."
            )),
        ],
        temperature=0.2,
        timeout=6,
    )
    if explanation:
        state["history"].append({"node": "logic_analyzer", "message": explanation.strip()[:800]})

    return state
