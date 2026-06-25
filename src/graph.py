"""
Graph assembly.

This is the architecture in one place. Read top-to-bottom it says:

    START
      -> router                 (classify)
      -> [conditional] one of: billing / refund / technical / general   (routing)
      -> critic                 (review)
      -> [conditional] revise --loop--> critic   OR   human_approval     (refinement loop)
      -> (INTERRUPT) human_approval                                       (human-in-the-loop)
      -> finalize
      -> END

Why these pieces:
  - Conditional edges after `router` = ROUTING to specialists.
  - `revise -> critic` = a bounded REFINEMENT LOOP.
  - `interrupt_before=['human_approval']` = HUMAN-IN-THE-LOOP gate before anything is "sent".
  - MemorySaver checkpointer = STATE/MEMORY persisted per thread, which is what lets the
    run pause at the interrupt and later resume with the human's decision.
"""

from __future__ import annotations

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from .state import SupportState
from . import agents


def build_graph():
    g = StateGraph(SupportState)

    # nodes
    g.add_node("router", agents.router)
    g.add_node("billing_agent", agents.billing_agent)
    g.add_node("refund_agent", agents.refund_agent)
    g.add_node("technical_agent", agents.technical_agent)
    g.add_node("general_agent", agents.general_agent)
    g.add_node("critic", agents.critic)
    g.add_node("revise", agents.revise)
    g.add_node("human_approval", agents.human_approval)
    g.add_node("finalize", agents.finalize)

    # entry
    g.add_edge(START, "router")

    # routing: router -> specialist
    g.add_conditional_edges(
        "router",
        agents.route_decision,
        {
            "billing_agent": "billing_agent",
            "refund_agent": "refund_agent",
            "technical_agent": "technical_agent",
            "general_agent": "general_agent",
        },
    )

    # every specialist hands its draft to the critic
    for specialist in ("billing_agent", "refund_agent", "technical_agent", "general_agent"):
        g.add_edge(specialist, "critic")

    # refinement loop: critic -> revise -> critic, or critic -> human_approval
    g.add_conditional_edges(
        "critic",
        agents.critic_decision,
        {"revise": "revise", "human_approval": "human_approval"},
    )
    g.add_edge("revise", "critic")

    # human gate -> finalize -> end
    g.add_edge("human_approval", "finalize")
    g.add_edge("finalize", END)

    checkpointer = MemorySaver()
    # The interrupt is what makes this human-in-the-loop: execution stops *before*
    # human_approval and returns to the caller until the graph is resumed.
    return g.compile(checkpointer=checkpointer, interrupt_before=["human_approval"])
