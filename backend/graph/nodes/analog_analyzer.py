"""Analog circuit analyzer node.

Derives a transfer function from the placed passive components (R, C, L) and
computes its Bode response, so the analog track produces a real frequency plot
from the canvas. The LLM only explains the result.
"""
import math

from ..state import GraphState
from ._llm import llm_explain

_PREFIX = {"p": 1e-12, "n": 1e-9, "u": 1e-6, "µ": 1e-6, "m": 1e-3, "k": 1e3, "K": 1e3, "M": 1e6, "G": 1e9}


def _si(value, unit) -> float:
    """Convert a value+unit (e.g. 100, 'nF') to SI base units."""
    try:
        v = float(value or 0)
    except (TypeError, ValueError):
        v = 0.0
    u = str(unit or "").strip()
    if len(u) >= 2 and u[0] in _PREFIX:
        return v * _PREFIX[u[0]]
    return v


def _first(nodes, ctype):
    for n in nodes:
        d = n.get("data", {})
        if d.get("type") == ctype:
            return _si(d.get("value"), d.get("unit"))
    return None


def _transfer_function(nodes):
    """Return (num, den, description, f0) for a recognized R/C/L topology."""
    R = _first(nodes, "R")
    C = _first(nodes, "C")
    L = _first(nodes, "L")

    if R and C and L:  # series RLC, output across C → 2nd-order low-pass
        f0 = 1.0 / (2 * math.pi * math.sqrt(L * C))
        return [1.0], [L * C, R * C, 1.0], f"series RLC low-pass, f0 = 1/(2*pi*sqrt(L*C)) = {f0:.1f} Hz", f0
    if R and C:  # RC low-pass
        fc = 1.0 / (2 * math.pi * R * C)
        return [1.0], [R * C, 1.0], f"RC low-pass, fc = 1/(2*pi*R*C) = {fc:.1f} Hz", fc
    if R and L:  # RL low-pass
        fc = R / (2 * math.pi * L)
        return [1.0], [L / R, 1.0], f"RL low-pass, fc = R/(2*pi*L) = {fc:.1f} Hz", fc
    return None


def analyze_analog_ac(nodes, edges):
    """Run real MNA AC analysis on the canvas; returns (bode_data, description).

    bode_data is None when the circuit can't be analyzed (e.g. no source/ground).
    """
    from math_service.ac_analysis import analyze_ac, ACRequest
    res = analyze_ac(ACRequest(nodes=nodes, edges=edges))
    if res.get("error"):
        return None, res["error"]
    bode = {
        "freqs_hz": res["freqs_hz"],
        "magnitude_db": res["magnitude_db"],
        "phase_deg": res["phase_deg"],
    }
    cuts = res.get("cutoffs_hz") or []
    ftype = res.get("filter_type", "response")
    import numpy as _np
    gain_db = float(_np.max(res["magnitude_db"])) if res.get("magnitude_db") else 0.0
    desc = f"{ftype} response"
    if cuts:
        desc += " with -3 dB cutoff at " + ", ".join(f"{c:.1f} Hz" for c in cuts)
    desc += f"; peak gain {gain_db:.1f} dB"
    # Real DC operating point (computed, not assumed) — so amplifier gains are exact.
    if res.get("bias_solved") and res.get("operating_point"):
        desc += ". DC bias: " + "; ".join(res["operating_point"])
    return bode, desc


def analog_analyzer(state: GraphState) -> GraphState:
    netlist = state.get("netlist", {})
    raw_input = str(state.get("raw_input", ""))
    nodes = netlist.get("nodes", [])
    edges = netlist.get("edges", [])
    component_types = sorted({n.get("data", {}).get("type", "?") for n in nodes})

    desc = None
    try:
        bode, desc = analyze_analog_ac(nodes, edges)
        if bode:
            state["artifacts"]["bode_data"] = bode
            state["history"].append({"node": "analog_analyzer", "message": f"AC analysis (nodal/MNA from your wiring): {desc}."})
        else:
            state["history"].append({"node": "analog_analyzer", "message": desc or "Could not analyze — check the wiring, source and ground."})
    except Exception as e:
        state["history"].append({"node": "analog_analyzer", "message": f"AC analysis error: {e}"})

    explanation = llm_explain(
        "You are an expert analog/RF circuit engineer replying to the user.",
        f"User request: {raw_input}\nComponents: {component_types}\n"
        f"Measured behaviour (from real nodal AC analysis): {desc or 'n/a'}.\n"
        "In 2-4 sentences, answer the user and explain this frequency behaviour. "
        "Trust the measured cutoff/type above — do not assume a different topology.",
    )
    if explanation:
        state["history"].append({"node": "analog_analyzer", "message": explanation})

    return state
