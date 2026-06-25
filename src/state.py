"""
Shared graph state.

LangGraph passes a single typed dict between nodes. Every node reads from and writes
to this object — this *is* the system's memory for one ticket. The checkpointer
(see graph.py) persists it per-thread, which is what makes human-in-the-loop resume
and multi-turn memory possible.
"""

from __future__ import annotations

from typing import Annotated, Literal, TypedDict
from operator import add

Category = Literal["billing", "refund", "technical", "general"]


class SupportState(TypedDict, total=False):
    # --- input ---
    ticket: str                      # raw customer message
    order_id: str                    # parsed/known order id, if any

    # --- routing ---
    category: Category               # decided by the router node

    # --- working memory ---
    tool_results: Annotated[list[str], add]   # appended by specialist agents (reducer = list concat)
    draft: str                       # current candidate reply
    critique: str                    # latest critic feedback
    revisions: int                   # refinement-loop counter (bounds the loop)

    # --- human-in-the-loop ---
    approved: bool                   # set by the human-approval step
    human_edit: str                  # optional human-edited reply that overrides the draft

    # --- output ---
    final_reply: str                 # what actually gets sent
    log: Annotated[list[str], add]   # human-readable trace of every node, for the demo
