import asyncio
import os
from graph.runner import run_graph_session
from sse.manager import sse_manager

async def main():
    print("Testing graph execution directly...")
    session_id = "test-session-123"
    raw_input = "Design a 2-bit comparator"
    canvas_json = {"nodes": [], "edges": []}
    
    # Run graph session as an asyncio task
    task = asyncio.create_task(run_graph_session(session_id, raw_input, canvas_json))
    
    # Manually consume SSE messages from the queue
    session = sse_manager.get_session(session_id)
    if not session:
        session = sse_manager.create_session(session_id)
        
    while True:
        try:
            # wait_for 2 seconds
            msg = await asyncio.wait_for(session.queue.get(), timeout=2.0)
            print("SSE MESSAGE:", msg)
            if session.completed:
                print("Session completed.")
                break
        except asyncio.TimeoutError:
            print("...waiting...")
            # Check if task is done and queue is empty
            if task.done():
                print("Task finished unexpectedly without completing session")
                break
                
    await task
    print("Done testing.")

if __name__ == "__main__":
    asyncio.run(main())
