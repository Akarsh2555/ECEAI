import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from uuid import uuid4

from math_service.router import router as math_router
from sse.router import router as sse_router
from auth.supabase_verify import verify_token

app = FastAPI(
    title="ECE Copilot API",
    description="Backend for ECE Copilot — digital logic, analog circuits, and signal processing",
    version="1.0.0",
)

# CORS origins: the production frontend URL(s) come from FRONTEND_URL and the
# optional comma-separated ALLOWED_ORIGINS. Localhost dev origins are added only
# outside production so a deployed API doesn't trust local machines.
APP_ENV = os.environ.get("APP_ENV", "development").lower()
_origins = {o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()}
if os.environ.get("FRONTEND_URL"):
    _origins.add(os.environ["FRONTEND_URL"].strip())
if APP_ENV != "production":
    _origins.update({
        "http://localhost:5173", "http://localhost:5174",
        "http://localhost:5175", "http://localhost:3000",
    })

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(_origins) or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(math_router, prefix="/math", tags=["Math Service"])
app.include_router(sse_router, prefix="/api", tags=["SSE"])


class SubmitBody(BaseModel):
    design_id: str
    canvas_json: dict
    user_message: str


class GenerateHdlBody(BaseModel):
    nodes: list[dict]
    edges: list[dict]
    intent: str | None = None
    language: str = "verilog"


class ApproveBody(BaseModel):
    session_id: str
    approved_ids: list[str]
    rejected_ids: list[str]


@app.get("/health")
async def health():
    # Safe deploy diagnostics — booleans only, never the secret values. Lets you
    # confirm from the browser whether Render actually has the env vars set.
    return {
        "status": "ok",
        "service": "ece-copilot-api",
        "app_env": os.environ.get("APP_ENV", "development"),
        "llm_configured": bool(os.environ.get("GOOGLE_API_KEY")),
        "supabase_configured": bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY")),
    }


@app.get("/api/llm_check")
async def llm_check():
    """Diagnostic: actually call each model in the chain ON THE SERVER and report
    the outcome (success / quota / invalid key / timeout) with timing. No secrets
    are returned. Useful to debug why chat falls back in a given environment."""
    import time
    if not os.environ.get("GOOGLE_API_KEY"):
        return {"ok": False, "reason": "GOOGLE_API_KEY not set"}
    from graph.nodes._llm import _MODELS
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.messages import HumanMessage

    results = []
    ok = False
    for m in _MODELS:
        t = time.time()
        try:
            r = await asyncio.to_thread(
                lambda mm=m: ChatGoogleGenerativeAI(model=mm, temperature=0, max_retries=0, timeout=12)
                .invoke([HumanMessage(content="Reply with the single word OK")])
            )
            results.append({"model": m, "ok": True, "elapsed_s": round(time.time() - t, 1), "text": str(r.content)[:40]})
            ok = True
            break
        except Exception as e:
            results.append({"model": m, "ok": False, "elapsed_s": round(time.time() - t, 1), "error": str(e)[:240]})
    return {"ok": ok, "chain": _MODELS, "results": results}


from graph.runner import run_graph_session
from sse.manager import sse_manager

@app.post("/api/design/submit")
async def submit_design(
    body: SubmitBody,
    background_tasks: BackgroundTasks,
    user: dict = Depends(verify_token),
):
    session_id = str(uuid4())
    # In production: store session in Supabase, launch LangGraph
    # Launch the graph in background
    background_tasks.add_task(run_graph_session, session_id, body.user_message, body.canvas_json)
    return {"session_id": session_id}


@app.post("/api/generate_hdl")
async def generate_hdl_endpoint(body: GenerateHdlBody, user: dict = Depends(verify_token)):
    """Produce production-grade, synthesizable HDL for the canvas via the LLM,
    grounded in the deterministic topology + structural netlist. Falls back to
    the structural Verilog when the LLM is unavailable."""
    from math_service.netlist_eval import netlist_to_verilog, analyze_digital, NetlistRequest
    from graph.nodes.hdl_synth import generate_industry_hdl

    structural = netlist_to_verilog(body.nodes, body.edges)
    try:
        summary = analyze_digital(NetlistRequest(nodes=body.nodes, edges=body.edges)).get("summary", {})
    except Exception:
        summary = {}
    result = generate_industry_hdl(
        structural_hdl=structural,
        summary=summary,
        intent=body.intent,
        language=body.language,
    )
    return result


@app.post("/api/design/approve")
async def approve_suggestions(
    body: ApproveBody,
    user: dict = Depends(verify_token),
):
    # Resume LangGraph with approved/rejected suggestions
    sse_manager.resume(body.session_id, body.approved_ids, body.rejected_ids)
    return {"status": "resumed"}
