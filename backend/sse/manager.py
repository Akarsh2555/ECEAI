"""In-memory SSE session manager.
Sessions live only in memory — they are NOT written to Supabase until
the graph completes (status = 'complete')."""
import asyncio
from dataclasses import dataclass, field
import json


@dataclass
class SSESession:
    session_id: str
    events: list[dict] = field(default_factory=list)
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    completed: bool = False
    resume_event: asyncio.Event = field(default_factory=asyncio.Event)
    approved_ids: list[str] = field(default_factory=list)
    rejected_ids: list[str] = field(default_factory=list)


class SSEManager:
    def __init__(self):
        self._sessions: dict[str, SSESession] = {}

    def create_session(self, session_id: str) -> SSESession:
        session = SSESession(session_id=session_id)
        self._sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> SSESession | None:
        return self._sessions.get(session_id)

    async def emit(self, session_id: str, event: dict):
        session = self._sessions.get(session_id)
        if session:
            session.events.append(event)
            await session.queue.put(json.dumps(event))

    async def emit_trace(self, session_id: str, message: str):
        await self.emit(session_id, {"type": "trace", "message": message})

    async def emit_suggestion(self, session_id: str, suggestion: dict):
        await self.emit(session_id, {"type": "suggestion", **suggestion})

    async def emit_artifact(self, session_id: str, kind: str, payload):
        await self.emit(session_id, {"type": "artifact", "kind": kind, "payload": payload})

    async def emit_done(self, session_id: str):
        await self.emit(session_id, {"type": "done"})
        session = self._sessions.get(session_id)
        if session:
            session.completed = True

    async def emit_error(self, session_id: str, message: str):
        await self.emit(session_id, {"type": "error", "message": message})

    def resume(self, session_id: str, approved_ids: list[str], rejected_ids: list[str]):
        session = self._sessions.get(session_id)
        if session:
            session.approved_ids = approved_ids
            session.rejected_ids = rejected_ids
            session.resume_event.set()

    def cleanup(self, session_id: str):
        self._sessions.pop(session_id, None)


# Singleton
sse_manager = SSEManager()
