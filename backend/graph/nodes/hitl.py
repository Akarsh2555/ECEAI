"""HITL node — pauses graph execution for human approval."""
from ..state import GraphState


def hitl(state: GraphState) -> GraphState:
    """Emit suggestions to the frontend and wait for user approval.
    In production, this pauses the graph and resumes via the SSE manager."""
    suggestions = state.get("suggestions", [])
    validation_errors = state.get("validation_errors", [])

    if validation_errors and validation_errors != ["PASS"]:
        for i, err in enumerate(validation_errors):
            suggestions.append({
                "id": f"fix-{i}",
                "description": f"Fix: {err}",
                "patch": {"error": err},
            })

    state["suggestions"] = suggestions
    state["history"].append({
        "node": "hitl",
        "message": f"Awaiting approval for {len(suggestions)} suggestion(s)",
    })
    return state
