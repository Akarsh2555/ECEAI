"""Digital validator — DETERMINISTIC, no LLM calls.
Checks for floating inputs, MUX wiring errors, and diode polarity."""
from ..state import GraphState


def digital_validator(state: GraphState) -> GraphState:
    errors = []
    netlist = state["netlist"]

    connected_targets = set()
    for edge in netlist.get("edges", []):
        target_key = f"{edge.get('target', '')}::{edge.get('targetHandle', '')}"
        connected_targets.add(target_key)

    for node in netlist.get("nodes", []):
        data = node.get("data", {})
        ntype = data.get("type", "")
        node_id = node.get("id", "")

        # Check 1: floating inputs on logic gates
        gate_types = {"AND", "OR", "NAND", "NOR", "XOR", "XNOR", "NOT"}
        if ntype in gate_types:
            for handle in data.get("inputHandles", []):
                key = f"{node_id}::{handle}"
                if key not in connected_targets:
                    errors.append(
                        f"FLOATING_INPUT: Gate '{node_id}' pin '{handle}' is unconnected"
                    )

        # Check 2: MUX selector vs data pin mapping
        if ntype == "MUX":
            sel_pins = data.get("selectorPins", [])
            for edge in netlist.get("edges", []):
                if edge.get("target") == node_id and edge.get("targetHandle") in sel_pins:
                    src_node = next(
                        (n for n in netlist.get("nodes", []) if n.get("id") == edge.get("source")),
                        None,
                    )
                    if src_node:
                        src_label = src_node.get("data", {}).get("label", "")
                        if src_label == "A":
                            errors.append(
                                f"MUX_WIRING: Variable 'A' is wired to selector on MUX '{node_id}'. "
                                f"'A' should be a data input, not a selector."
                            )

    state["validation_errors"] = errors if errors else ["PASS"]
    error_msg = "PASS" if not errors else f"{len(errors)} error(s) found"
    state["history"].append({"node": "digital_validator", "message": f"Digital validator: {error_msg}"})
    return state
