"""FastAPI app — the Python backend for PageForge.

Exposes the same two endpoints the React UI already calls, with the same
Server-Sent-Events contract, so the frontend is unchanged:

  POST /api/plan      Plan Mode step 1 — runs the Strategist, streams the Plan.
    body:  { brief: str, model?: str, credentials?: {...} }
    events: progress { label } · done { plan } · error { message }

  POST /api/generate  Plan Mode step 2 — runs the Generator, streams the HTML.
    body:  { plan: Plan, images?: [str], model?: str, credentials?: {...} }
    events: progress { label } · done { html } · error { message }

Ports web/app/api/plan/route.ts and web/app/api/generate/route.ts.
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import AsyncGenerator, List, Optional

from dotenv import load_dotenv

# Load env BEFORE importing modules that read it. The canonical source of truth
# is web/.env.local (shared with the frontend); server/.env can override locally.
_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_ROOT / "server" / ".env", override=False)
load_dotenv(_ROOT / "web" / ".env.local", override=False)

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import PlainTextResponse, StreamingResponse  # noqa: E402
from pydantic import BaseModel, ConfigDict  # noqa: E402

from .graph import html_from_plan, plan_from_brief  # noqa: E402
from .types import BUILD_STEP, PLAN_STEP, Credentials, Plan  # noqa: E402

app = FastAPI(title="PageForge backend", version="1.0.0")

# Allow the Next.js dev server to call this directly if it ever bypasses the
# proxy rewrite. The default deployment path is server-to-server (no CORS).
_origins = os.environ.get("FRONTEND_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_origins] if _origins != "*" else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_SSE_HEADERS = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    # Disable proxy buffering so each event flushes immediately.
    "X-Accel-Buffering": "no",
}


def _sse(event: str, data: object) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n".encode("utf-8")


# --------------------------------------------------------------------------- #
# Request bodies                                                              #
# --------------------------------------------------------------------------- #
class PlanRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    brief: Optional[str] = None
    model: Optional[str] = None
    credentials: Optional[Credentials] = None


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    plan: Optional[Plan] = None
    images: Optional[List[str]] = None
    model: Optional[str] = None
    credentials: Optional[Credentials] = None


# --------------------------------------------------------------------------- #
# Health                                                                      #
# --------------------------------------------------------------------------- #
@app.get("/")
def root():
    return {"service": "pageforge-backend", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}


# --------------------------------------------------------------------------- #
# POST /api/plan — Plan Mode, step 1                                          #
# --------------------------------------------------------------------------- #
@app.post("/api/plan")
async def plan(req: PlanRequest):
    brief = (req.brief or "").strip()
    if not brief:
        return PlainTextResponse("Missing required field: brief", status_code=400)

    async def stream() -> AsyncGenerator[bytes, None]:
        try:
            yield _sse("progress", {"label": PLAN_STEP})
            plan_obj = await asyncio.to_thread(
                plan_from_brief, brief, req.model, req.credentials
            )
            yield _sse("done", {"plan": plan_obj.model_dump()})
        except Exception as err:  # noqa: BLE001 — surface any failure to the client
            message = str(err) or "Planning failed unexpectedly."
            yield _sse("error", {"message": message})

    return StreamingResponse(stream(), headers=_SSE_HEADERS)


# --------------------------------------------------------------------------- #
# POST /api/generate — Plan Mode, step 2                                      #
# --------------------------------------------------------------------------- #
@app.post("/api/generate")
async def generate(req: GenerateRequest):
    if req.plan is None or req.plan.business is None or req.plan.strategy is None:
        return PlainTextResponse("Missing or malformed field: plan", status_code=400)

    images = req.images or []

    async def stream() -> AsyncGenerator[bytes, None]:
        try:
            yield _sse("progress", {"label": BUILD_STEP})
            html = await asyncio.to_thread(
                html_from_plan, req.plan, images, req.model, req.credentials
            )
            yield _sse("done", {"html": html})
        except Exception as err:  # noqa: BLE001 — surface any failure to the client
            message = str(err) or "Generation failed unexpectedly."
            yield _sse("error", {"message": message})

    return StreamingResponse(stream(), headers=_SSE_HEADERS)
