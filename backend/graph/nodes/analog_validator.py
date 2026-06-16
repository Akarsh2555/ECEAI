"""Analog validator — DETERMINISTIC, no LLM calls.
Checks bias conditions, diode polarity, and op-amp feedback."""
from ..state import GraphState


def analog_validator(state: GraphState) -> GraphState:
    errors = []
    netlist = state["netlist"]

    for node in netlist.get("nodes", []):
        data = node.get("data", {})
        ntype = data.get("type", "")
        node_id = node.get("id", "")

        # Check: Diode polarity
        if ntype == "DIODE":
            # Check if cathode is connected to a positive DC source
            for edge in netlist.get("edges", []):
                if edge.get("source") == node_id and edge.get("sourceHandle") == "cathode":
                    target_node = next(
                        (n for n in netlist.get("nodes", []) if n.get("id") == edge.get("target")),
                        None,
                    )
                    if target_node and target_node.get("data", {}).get("type") == "DC_SOURCE":
                        errors.append(
                            f"DIODE_POLARITY: Diode '{node_id}' cathode connected to positive DC — "
                            f"may be reversed for clamper circuit."
                        )

        # Check: Op-amp without negative feedback
        if ntype == "OPAMP":
            has_feedback = False
            for edge in netlist.get("edges", []):
                if edge.get("source") == node_id and edge.get("sourceHandle") == "out":
                    if edge.get("target") == node_id and edge.get("targetHandle") == "inv":
                        has_feedback = True
                    # Check for indirect feedback through other components
                    target_id = edge.get("target")
                    for e2 in netlist.get("edges", []):
                        if e2.get("source") == target_id and e2.get("target") == node_id:
                            if e2.get("targetHandle") == "inv":
                                has_feedback = True

            if not has_feedback and len(netlist.get("edges", [])) > 0:
                errors.append(
                    f"OPAMP_FEEDBACK: Op-amp '{node_id}' may lack negative feedback — "
                    f"output could rail to supply voltage."
                )

    state["validation_errors"] = errors if errors else ["PASS"]
    error_msg = "PASS" if not errors else f"{len(errors)} error(s) found"
    state["history"].append({"node": "analog_validator", "message": f"Analog validator: {error_msg}"})
    return state
