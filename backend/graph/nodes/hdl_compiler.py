"""HDL compiler — netlist to HDL.

Produces production-grade, synthesizable HDL via the LLM (graph/nodes/hdl_synth),
grounded in the deterministic topology analysis + the structural netlist so the
behaviour and ports are correct. The structural Verilog from
math_service.netlist_eval.netlist_to_verilog is used as the grounding reference
and as the offline fallback when the LLM is unavailable (no key / quota / timeout).
"""
from ..state import GraphState
from math_service.netlist_eval import netlist_to_verilog, analyze_digital, NetlistRequest
from .hdl_synth import generate_industry_hdl


def hdl_compiler(state: GraphState) -> GraphState:
    netlist = state["netlist"]
    nodes = netlist.get("nodes", [])
    edges = netlist.get("edges", [])

    structural = netlist_to_verilog(nodes, edges)

    # Deterministic topology (async/sync, counter/shift/state machine) to ground the LLM.
    summary = {}
    try:
        summary = analyze_digital(NetlistRequest(nodes=nodes, edges=edges)).get("summary", {})
    except Exception:
        summary = {}

    result = generate_industry_hdl(
        structural_hdl=structural,
        summary=summary,
        intent=str(state.get("raw_input", "")) or None,
        language="verilog",
    )

    state["artifacts"]["hdl_code"] = result["hdl"]
    state["artifacts"]["hdl_language"] = result["language"]
    src = "LLM (production-grade)" if result["source"] == "llm" else "structural netlist (LLM unavailable)"
    state["history"].append({"node": "hdl_compiler", "message": f"Generated Verilog HDL — {src}."})
    return state
