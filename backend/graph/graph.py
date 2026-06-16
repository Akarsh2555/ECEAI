"""Main graph definition using LangGraph."""
from langgraph.graph import StateGraph, END
from .state import GraphState
from .edges import route_by_domain, route_after_validation, route_after_hitl
from .nodes.ingestion_router import ingestion_router
from .nodes.digital_validator import digital_validator
from .nodes.analog_validator import analog_validator
from .nodes.logic_analyzer import logic_analyzer
from .nodes.analog_analyzer import analog_analyzer
from .nodes.system_simulator import system_simulator
from .nodes.chat_responder import chat_responder
from .nodes.hitl import hitl
from .nodes.hdl_compiler import hdl_compiler
from .nodes.script_generator import script_generator

def create_graph():
    workflow = StateGraph(GraphState)

    # Add nodes
    workflow.add_node("ingestion_router", ingestion_router)
    workflow.add_node("digital_validator", digital_validator)
    workflow.add_node("analog_validator", analog_validator)
    workflow.add_node("logic_analyzer", logic_analyzer)
    workflow.add_node("analog_analyzer", analog_analyzer)
    workflow.add_node("system_simulator", system_simulator)
    workflow.add_node("chat_responder", chat_responder)
    workflow.add_node("hitl", hitl)
    workflow.add_node("hdl_compiler", hdl_compiler)
    workflow.add_node("script_generator", script_generator)

    # Set entry point
    workflow.set_entry_point("ingestion_router")

    # Routing from ingestion
    workflow.add_conditional_edges(
        "ingestion_router",
        route_by_domain,
        {
            "digital_validator": "digital_validator",
            "analog_validator": "analog_validator",
            "system_simulator": "system_simulator",
            "chat_responder": "chat_responder"
        }
    )

    # Digital path
    workflow.add_conditional_edges(
        "digital_validator",
        route_after_validation,
        {
            "logic_analyzer": "logic_analyzer",
            "hitl": "hitl"
        }
    )
    workflow.add_edge("logic_analyzer", "hitl")
    
    # Analog path
    workflow.add_conditional_edges(
        "analog_validator",
        route_after_validation,
        {
            "analog_analyzer": "analog_analyzer",
            "hitl": "hitl"
        }
    )
    workflow.add_edge("analog_analyzer", "hitl")

    # System / communication path — simulation is terminal (no HITL needed).
    workflow.add_edge("system_simulator", END)

    # Conversational path — answer and finish.
    workflow.add_edge("chat_responder", END)

    # After HITL
    workflow.add_conditional_edges(
        "hitl",
        route_after_hitl,
        {
            "hdl_compiler": "hdl_compiler",
            "script_generator": "script_generator",
            "end": END
        }
    )

    # Endings
    workflow.add_edge("hdl_compiler", END)
    workflow.add_edge("script_generator", END)

    return workflow.compile()

# Global compiled graph
agent_graph = create_graph()
