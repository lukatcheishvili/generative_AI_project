"""
Shared state threaded through the PageForge LangGraph pipeline.

The brief flows in; the Strategist writes `plan`; the graph PAUSES (interrupt)
so a human can review/edit `plan`; the Generator then writes `html`.
"""

from typing import TypedDict


class PipelineState(TypedDict, total=False):
    brief: str            # the user's free-form business description
    model: str            # optional per-request model id (UI picker)
    creds: dict           # optional per-session credential overrides (Settings panel)
    images: list          # base64 data URIs of uploaded photos
    plan: dict            # {business, strategy, framerId} — produced by the Strategist
    html: str             # the finished landing page — produced by the Generator
