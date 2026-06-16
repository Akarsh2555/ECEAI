"""Conditional edge functions for the LangGraph state graph."""
from .state import GraphState


def route_by_domain(state: GraphState) -> str:
    """Route conversational messages to the chat responder; otherwise route to
    the domain analysis pipeline."""
    if state.get("intent") == "chat":
        return "chat_responder"
    domain = state.get("domain", "digital")
    if domain == "digital":
        return "digital_validator"
    elif domain == "analog":
        return "analog_validator"
    elif domain == "system":
        return "system_simulator"
    return "digital_validator"


def route_after_validation(state: GraphState) -> str:
    """Route after validation: to analyzer if pass, or back with errors."""
    errors = state.get("validation_errors", [])
    if errors == ["PASS"] or not errors:
        domain = state.get("domain", "digital")
        if domain == "digital":
            return "logic_analyzer"
        elif domain == "analog":
            return "analog_analyzer"
        return "hitl"
    return "hitl"  # Show errors as suggestions for user to fix


def route_after_hitl(state: GraphState) -> str:
    """Route after human-in-the-loop approval."""
    domain = state.get("domain", "digital")
    if domain == "digital":
        return "hdl_compiler"
    return "end"
