"""BOM optimizer node — calculates bill of materials from netlist."""
from ..state import GraphState


def bom_optimizer(state: GraphState) -> GraphState:
    netlist = state["netlist"]
    nodes = netlist.get("nodes", [])

    components = [node.get("data", {}) for node in nodes]

    # Import and call the math service BOM calculator
    from math_service.bom import BomRequest, compute_bom

    req = BomRequest(components=components)
    bom_result = compute_bom(req)

    state["artifacts"]["bom"] = bom_result
    state["history"].append({
        "node": "bom_optimizer",
        "message": f"BOM: {len(bom_result['entries'])} entries, total ${bom_result['totalCost']:.2f}",
    })
    return state
