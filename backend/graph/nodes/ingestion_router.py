"""Ingestion router — classifies input domain and normalizes netlist.
DETERMINISTIC — no LLM calls in this node."""
from ..state import GraphState


def _detect_domain_from_text(text: str) -> str | None:
    """Keyword-based domain detection from a natural-language request."""
    lowered = text.lower()
    if any(k in lowered for k in ["modulat", "carrier", "constellation", "qam", "psk", "fsk", "ask",
                                  "transfer function", "feedback", "control system", "step response", "scope"]):
        return "system"
    if any(k in lowered for k in ["resistor", "capacitor", "inductor", "opamp", "transistor", "diode", "amplifier"]):
        return "analog"
    if any(k in lowered for k in ["gate", "logic", "mux", "flip-flop", "flip flop", "adder", "comparator", "verilog", "vhdl"]):
        return "digital"
    return None


def ingestion_router(state: GraphState) -> GraphState:
    raw = state["raw_input"]

    # The canvas netlist arrives in state["netlist"] (from the runner); the
    # user's natural-language message arrives in state["raw_input"]. Earlier
    # versions overwrote the netlist with an empty one whenever raw_input was a
    # string, discarding the canvas. Preserve the canvas and only fall back to
    # an empty netlist when none was provided.
    if isinstance(raw, dict) and raw.get("nodes") is not None:
        netlist = raw
    else:
        netlist = state.get("netlist") or {"nodes": [], "edges": [], "domain": "digital"}

    # Prefer an explicit domain on the netlist; otherwise infer from the request
    # text, defaulting to digital.
    domain = netlist.get("domain")
    if not domain:
        text = raw if isinstance(raw, str) else str(raw)
        domain = _detect_domain_from_text(text) or "digital"

    # Intent: is the user asking us to (re)compute/build (-> run the analysis
    # pipeline), or just talking/asking about the circuit (-> conversational
    # responder)? Default to conversation so the user can freely chat.
    text = (raw if isinstance(raw, str) else str(raw)).lower()
    analyze_kw = (
        "simulate", "run ", "analyze", "analyse", "build", "generate", "create",
        "design", "compute", "plot", "evaluate", "construct", "make ", "compile",
        "minimize", "minimise", "validate",
    )
    state["intent"] = "analyze" if any(k in text for k in analyze_kw) else "chat"

    state["domain"] = domain
    state["netlist"] = netlist
    state["history"].append({"node": "ingestion_router", "message": f"Domain detected: {domain}"})
    return state
