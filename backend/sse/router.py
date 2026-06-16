import asyncio
from fastapi import APIRouter, Request, Query
from fastapi.responses import StreamingResponse
from .manager import sse_manager

router = APIRouter()


@router.get("/stream/{session_id}")
async def stream_events(
    request: Request,
    session_id: str,
    token: str = Query(default=""),
):
    """SSE endpoint streaming LangGraph agent events to the frontend."""

    session = sse_manager.get_session(session_id)
    if not session:
        # Create session on-demand for demo purposes
        session = sse_manager.create_session(session_id)

    async def event_generator():
        # The queue already buffers every event emitted before the client
        # connected (asyncio.Queue retains items until consumed), so we deliver
        # purely from the queue. Replaying session.events in addition would
        # double-deliver every pre-connection event. Send an initial comment so
        # the connection opens immediately.
        try:
            yield ": connected\n\n"

            while True:
                if await request.is_disconnected():
                    break

                try:
                    event_data = await asyncio.wait_for(session.queue.get(), timeout=20.0)
                    yield f"data: {event_data}\n\n"

                    # Stop once the terminal 'done' event has been delivered.
                    if '"type": "done"' in event_data:
                        break
                except asyncio.TimeoutError:
                    # Keep-alive comment so proxies don't drop the connection.
                    yield ": heartbeat\n\n"
        finally:
            if session.completed:
                sse_manager.cleanup(session_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
