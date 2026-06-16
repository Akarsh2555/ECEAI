"""Shared LLM helper for agent nodes (Google Gemini).

The LLM only explains — all numbers come from the deterministic math service.

Important: the google-generativeai SDK does its OWN blocking retry on 429
(RESOURCE_EXHAUSTED), honoring the server's retry_delay (can be ~60s), and
langchain's max_retries does NOT override it. So we run every call in a worker
thread with a hard wall-clock timeout: the graph node can never block more than
`timeout` seconds on the LLM, even when the key is rate-limited. A timed-out
call's thread is simply abandoned (harmless), and the node proceeds without an
explanation.
"""
import os
import concurrent.futures

# The heavier flash models (3.5/2.5/2.0-flash) exhaust the free-tier quota fast
# (429 RESOURCE_EXHAUSTED). gemini-2.5-flash-lite has much higher free limits and
# responds in ~1.5s. Override with GEMINI_MODEL (use a paid/billed key to unlock
# the larger models).
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")

# The free tier caps requests PER MODEL PER DAY (e.g. 20/day for flash-lite). The
# quota is per-model, so when one model is exhausted (429 RESOURCE_EXHAUSTED) we
# fall through to the next — each has its OWN daily allowance, which multiplies
# the effective free budget. Override the whole chain with GEMINI_MODELS (CSV).
# Order matters: try a model that currently HAS quota first. flash-lite has a
# tiny free daily cap (20/day) that exhausts fast, and a request to an exhausted
# model can burn the whole per-call timeout before we fail over — so it goes LAST.
_MODELS = [m.strip() for m in os.environ.get(
    "GEMINI_MODELS",
    f"gemini-2.5-flash,gemini-flash-latest,{MODEL},gemini-2.0-flash",
).split(",") if m.strip()]
# De-dup while preserving order.
_MODELS = list(dict.fromkeys(_MODELS))

# Per-request client timeout. Generous by default because throttled hosts (e.g.
# Render free tier) are far slower than a dev laptop — a 5 s cap there made every
# call time out and fall back. Tune with LLM_REQUEST_TIMEOUT.
_REQ_TIMEOUT = float(os.environ.get("LLM_REQUEST_TIMEOUT", "12"))

_PLAIN_TEXT_RULE = (
    " Reply in plain conversational English. Do NOT use Markdown, headings, "
    "asterisks/bold, bullet symbols, or LaTeX/dollar-sign math; write any "
    "equations in plain text like 'fc = 1/(2*pi*R*C)'."
)

_EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="llm")


def _invoke(messages, temperature: float) -> str:
    from langchain_google_genai import ChatGoogleGenerativeAI

    last_err: Exception | None = None
    for model in _MODELS:
        try:
            # Per-request timeout so a quota-blocked model fails fast.
            llm = ChatGoogleGenerativeAI(model=model, temperature=temperature, max_retries=0, timeout=_REQ_TIMEOUT)
            resp = llm.invoke(messages)
            content = resp.content
            if isinstance(content, list):
                content = "".join(c.get("text", "") if isinstance(c, dict) else str(c) for c in content)
            if content and str(content).strip():
                return content
        except Exception as e:  # 429 / model-not-available / transient — try the next model
            last_err = e
            continue
    if last_err:
        raise last_err
    return ""


def invoke_text(messages, temperature: float = 0.3, timeout: float = 6.0) -> str | None:
    """Run an LLM chat call with a hard timeout. Returns text or None."""
    if not os.environ.get("GOOGLE_API_KEY"):
        return None
    # The overall budget must let at least one per-request attempt (_REQ_TIMEOUT)
    # finish; otherwise on slow hosts the future is cut before the model replies.
    budget = max(timeout, _REQ_TIMEOUT + 3.0)
    future = _EXECUTOR.submit(_invoke, messages, temperature)
    try:
        return future.result(timeout=budget)
    except Exception:
        return None  # timeout, rate-limit, or error — proceed without the LLM


def llm_explain(system_prompt: str, user_prompt: str, temperature: float = 0.3, timeout: float = 6.0) -> str | None:
    """Return a plain-text explanation, or None if unavailable."""
    from langchain_core.messages import SystemMessage, HumanMessage

    text = invoke_text(
        [SystemMessage(content=system_prompt + _PLAIN_TEXT_RULE), HumanMessage(content=user_prompt)],
        temperature,
        timeout,
    )
    return text.strip()[:800] if text and text.strip() else None

async def allm_explain(system_prompt: str, user_prompt: str, temperature: float = 0.3, timeout: float = 6.0) -> str | None:
    """Async-friendly explanation with a HARD wall-clock timeout.

    Note: we deliberately do NOT use llm.astream + asyncio.wait_for — the Gemini
    client's call blocks the event loop and ignores cancellation, so the timeout
    is silently exceeded (observed ~34 s on a quota-throttled model). Delegating
    to the threaded `llm_explain` (ThreadPoolExecutor + future.result(timeout))
    enforces the timeout reliably by abandoning the worker thread. The chat answer
    is still delivered to the UI via the SSE history stream when the node returns.
    """
    import asyncio
    return await asyncio.to_thread(llm_explain, system_prompt, user_prompt, temperature, timeout)
