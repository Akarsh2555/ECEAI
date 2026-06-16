"""LangGraph state definition for the ECE Copilot agent graph."""
from typing import TypedDict, Literal, Optional


class GraphState(TypedDict):
    raw_input: str | dict
    domain: Optional[Literal["digital", "analog", "system"]]
    netlist: dict
    user_constraints: dict
    validation_errors: list[str]
    suggestions: list[dict]  # [{id, description, patch}]
    user_approvals: list[str]
    artifacts: dict  # hdl_code, truth_table, bode_data, bom…
    history: list[dict]  # full trace for SSE
    session_id: str
