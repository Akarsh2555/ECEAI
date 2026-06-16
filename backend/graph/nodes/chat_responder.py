"""Conversational responder node.

Lets the user *talk about* their circuit ("why two sidebands?", "what is the
steady-state?", "explain the feedback path") rather than only triggering
analysis. It builds context from the canvas (and computes the cheap artifacts so
the plots still populate), then answers conversationally via the LLM — with a
deterministic fallback so the chat always replies, even when the LLM is
rate-limited.
"""
from ..state import GraphState
from ._llm import llm_explain


def _system_context(nodes, edges, state: GraphState) -> str:
    from .system_simulator import _describe_system, _pick_timing
    from math_service.simulate import simulate, SimulateRequest
    desc = _describe_system(nodes, edges)
    try:
        t_end, n = _pick_timing(nodes)
        res = simulate(SimulateRequest(nodes=nodes, edges=edges, t_end=t_end, n_points=n))
        state["artifacts"]["simulation"] = res
        if res.get("spectra"):
            peaks = []
            for sp in res["spectra"][:1]:
                import numpy as np
                f = np.array(sp["freqs"]); m = np.array(sp["magnitude"])
                peaks = [round(float(f[i]), 1) for i in range(len(m)) if m[i] > 0.1]
            if peaks:
                desc += f" Measured spectral peaks: {peaks} Hz."
    except Exception:
        pass
    return desc


def _digital_context(nodes, edges, state: GraphState) -> str:
    # Reuse the same wiring-derived analysis as the analyze path (handles
    # combinational truth tables AND sequential flip-flop timing diagrams).
    try:
        from .logic_analyzer import _analyze_from_wiring
        return _analyze_from_wiring(state, nodes, edges)
    except Exception:
        types = [n.get("data", {}).get("type") for n in nodes]
        return f"Digital circuit with components: {types}."


def _analog_context(nodes, edges, state: GraphState) -> str:
    try:
        from .analog_analyzer import analyze_analog_ac
        bode, desc = analyze_analog_ac(nodes, edges)
        if bode:
            state["artifacts"]["bode_data"] = bode
            return f"Analog circuit (real nodal AC analysis): {desc}."
        if desc:
            return f"Analog circuit — {desc}."
    except Exception:
        pass
    types = [n.get("data", {}).get("type") for n in nodes]
    return f"Analog circuit with components: {types}."


from ..state import GraphState
from ._llm import allm_explain

# ... (keep the other context helper functions unmodified) ...

import re as _re


def _sequential_numeric(message, nodes, edges):
    """Answer numeric sequential questions deterministically, e.g.
    'if the current state is 0010, what is the state after 6 clock cycles?'"""
    from math_service.netlist_eval import _is_sequential, solve_sequential
    if not _is_sequential(nodes):
        return None
    m = message.lower()
    cyc = _re.search(r"(\d+)\s*(?:clock\s*)?(?:cycle|clock|tick|pulse|edge)", m)
    
    # Robustly search for input values before or after the keyword "input"
    inp_match = _re.search(r"\binput\s+(?:is\s+|of\s+|to\s+)?([01]+)\b|\b([01]+)\b\s+(?:as\s+(?:an|the)\s+)?input", m)
    input_bits = inp_match.group(1) or inp_match.group(2) if inp_match else None
    
    binaries = _re.findall(r"\b([01]{1,})\b", m)
    init_bits = None
    if binaries:
        for b in binaries:
            if inp_match and b == input_bits and "input" in m:
                continue
            init_bits = b
            break
        if init_bits is None:
            init_bits = binaries[0]
            
    if not cyc and not init_bits:
        return None
        
    cycles = int(cyc.group(1)) if cyc else 6
    res = solve_sequential(nodes, edges, init_bits=init_bits, cycles=cycles, input_bits=input_bits)
    note = f" (input held at {input_bits})" if res.get("has_inputs") and input_bits else (" (input held at 0)" if res.get("has_inputs") else "")
    return (
        f"Computed sequential result — flip-flop bit order (left to right): {', '.join(res['order'])}. "
        f"Starting from {res['initial']}, after {cycles} clock cycle(s) the state is {res['final']}{note}. "
        f"Full state sequence: {' -> '.join(res['sequence'])}."
    )


async def chat_responder(state: GraphState) -> GraphState:
    netlist = state.get("netlist", {})
    nodes = netlist.get("nodes", [])
    edges = netlist.get("edges", [])
    domain = state.get("domain", "digital")
    message = str(state.get("raw_input", ""))

    # General ECE conversation when the canvas is empty.
    if not nodes:
        answer = await allm_explain(
            "You are a friendly, knowledgeable ECE (electronics & communications) tutor "
            "chatting with the user.",
            message,
            timeout=8,
        )
        state["history"].append({
            "node": "chat_responder",
            "message": answer or (
                "Your canvas is empty, so there's no circuit to inspect yet — drag some blocks on "
                "and I can explain or simulate it. You can also ask me general ECE questions any time."
            ),
        })
        return state

    if domain == "system":
        context = _system_context(nodes, edges, state)
    elif domain == "digital":
        context = _digital_context(nodes, edges, state)
        numeric = _sequential_numeric(message, nodes, edges)
        if numeric:
            context = numeric + "\n\n" + context
    elif domain == "analog":
        context = _analog_context(nodes, edges, state)
    else:
        types = [n.get("data", {}).get("type") for n in nodes]
        context = f"{domain} circuit with blocks: {types}."

    answer = await allm_explain(
        "You are an ECE design copilot having a back-and-forth conversation with the user about "
        "the circuit on their canvas. Answer the user's question directly, concretely and "
        "conversationally. The user may ask qualitative questions OR basic numericals (e.g. the "
        "flip-flop state after N clock cycles, a cutoff frequency, or a truth-table output). If the "
        "circuit context already contains a computed numeric result, use THAT exact value in your "
        "answer — never recompute or guess the numbers yourself.",
        f"Circuit context: {context}\n\nUser: {message}\n\nReply in 2-5 sentences.",
        timeout=8,
    )
    if not answer:
        # Every model in the chain is rate-limited (free-tier daily cap). Be
        # honest: give the deterministic circuit facts we DID compute, but make
        # clear that open-ended Q&A needs the AI model, which is unavailable now.
        answer = (
            f"Here's what I can tell you from the circuit itself: {context}\n\n"
            "I couldn't reach the AI model to answer that in depth — the Gemini free-tier "
            "daily request limit is currently exhausted. Computation and simulation still work "
            "(say 'simulate' / 'analyze'). For conversational follow-ups, add a billed Gemini key "
            "or set GEMINI_MODELS to models that still have quota; it resets every 24 hours."
        )

    state["history"].append({"node": "chat_responder", "message": answer})
    return state
