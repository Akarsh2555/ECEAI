import logging
from sse.manager import sse_manager
from graph.graph import agent_graph
from graph.state import GraphState

logger = logging.getLogger(__name__)

async def run_graph_session(session_id: str, raw_input: str, canvas_json: dict):
    # Initialize state
    initial_state: GraphState = {
        "raw_input": raw_input,
        "domain": None,
        "netlist": canvas_json,
        "user_constraints": {},
        "validation_errors": [],
        "suggestions": [],
        "user_approvals": [],
        "artifacts": {},
        "history": [],
        "session_id": session_id
    }
    
    # Create the session in SSE manager
    session = sse_manager.get_session(session_id)
    if not session:
        session = sse_manager.create_session(session_id)
        
    try:
        # Run the graph
        # Since langgraph runs synchronously by default in this setup, we can use astream or run it in a thread.
        # But we'll run it step by step to emit SSE events.
        
        emitted = 0  # cursor into state["history"] so each message is sent once
        async for mode, data in agent_graph.astream(initial_state, stream_mode=["updates", "messages"]):
            if mode == "messages":
                chunk, metadata = data
                if metadata.get("langgraph_node") == "chat_responder" and chunk.content:
                    await sse_manager.emit(session_id, {"type": "chat_chunk", "message": chunk.content})
            elif mode == "updates":
                for node_name, state in data.items():
                    current_state = state

                    # Emit every new history entry this node produced (a node may add
                    # several — e.g. the analyzer adds its conversational reply AND a
                    # note about the generated artifacts). Without this, the AI's
                    # actual answer to the user is dropped.
                    history = state.get("history", [])
                    new_entries = history[emitted:]
                    if new_entries:
                        for entry in new_entries:
                            node = entry.get("node", node_name)
                            await sse_manager.emit_trace(session_id, f"[{node}] {entry.get('message', '')}")
                        emitted = len(history)
                    else:
                        await sse_manager.emit_trace(session_id, f"[{node_name}] Completed")

                    # Check for suggestions emitted by this node
                    if node_name == "hitl" and state.get("suggestions"):
                        for sug in state["suggestions"]:
                            await sse_manager.emit_suggestion(session_id, sug)
                        
                        # Pause and wait for user approval
                        await sse_manager.emit_trace(session_id, "⏸️ Waiting for user approval on suggestions...")
                        await session.resume_event.wait()
                        session.resume_event.clear()
                        
                        current_state["user_approvals"] = session.approved_ids
                        await sse_manager.emit_trace(session_id, f"▶️ Resuming graph... Approved: {session.approved_ids}")
                        
        # Graph execution completed
        for kind, payload in current_state.get("artifacts", {}).items():
            await sse_manager.emit_artifact(session_id, kind, payload)
            
        await sse_manager.emit_trace(session_id, "✅ Analysis complete.")
        await sse_manager.emit_done(session_id)
        
    except Exception as e:
        logger.exception("Graph execution failed for session %s", session_id)
        await sse_manager.emit_error(session_id, f"Graph execution failed: {str(e)}")
        await sse_manager.emit_done(session_id)
