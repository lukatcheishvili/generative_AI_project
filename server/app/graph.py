"""The pipeline as LangGraph.js graphs — ported to LangGraph (Python).

In the web app the two agents are invoked as SEPARATE requests (/api/plan then
/api/generate) so a human can approve the plan in between — the "interrupt before
you act" gate from the original design. Each step still runs *through* LangGraph:

  - STRATEGIST_GRAPH : START -> strategist -> END   (drives /api/plan)
  - GENERATOR_GRAPH  : START -> generator  -> END   (drives /api/generate)
  - PIPELINE_GRAPH   : START -> strategist -> generator -> END
                       the canonical, non-interactive end-to-end pipeline
                       (used for tests / a future one-shot path), exactly the
                       graph the TypeScript lib/graph.ts documented.

Keeping three small graphs that share the same node functions means LangGraph is
genuinely the orchestrator for every model call, while the stateless HTTP
contract the React UI relies on is preserved unchanged.
"""

from __future__ import annotations

from typing import List, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from .agents import run_generator, run_strategist
from .types import Credentials, Plan


class PipelineState(TypedDict, total=False):
    brief: str
    model: Optional[str]
    creds: Optional[Credentials]
    images: List[str]
    plan: Plan
    html: str


def _strategist_node(state: PipelineState) -> PipelineState:
    plan = run_strategist(state["brief"], state.get("model"), state.get("creds"))
    return {"plan": plan}


def _generator_node(state: PipelineState) -> PipelineState:
    html = run_generator(
        state["plan"],
        state.get("images") or [],
        state.get("model"),
        state.get("creds"),
    )
    return {"html": html}


def _build_strategist_graph():
    g = StateGraph(PipelineState)
    g.add_node("strategist", _strategist_node)
    g.add_edge(START, "strategist")
    g.add_edge("strategist", END)
    return g.compile()


def _build_generator_graph():
    g = StateGraph(PipelineState)
    g.add_node("generator", _generator_node)
    g.add_edge(START, "generator")
    g.add_edge("generator", END)
    return g.compile()


def _build_pipeline_graph():
    g = StateGraph(PipelineState)
    g.add_node("strategist", _strategist_node)
    g.add_node("generator", _generator_node)
    g.add_edge(START, "strategist")
    g.add_edge("strategist", "generator")
    g.add_edge("generator", END)
    return g.compile()


# Compiled once at import; reused across requests (graphs are stateless here).
STRATEGIST_GRAPH = _build_strategist_graph()
GENERATOR_GRAPH = _build_generator_graph()
PIPELINE_GRAPH = _build_pipeline_graph()


def plan_from_brief(
    brief: str,
    model: Optional[str] = None,
    creds: Optional[Credentials] = None,
) -> Plan:
    """Run the Strategist through LangGraph and return the Plan to approve."""
    result = STRATEGIST_GRAPH.invoke({"brief": brief, "model": model, "creds": creds})
    return result["plan"]


def html_from_plan(
    plan: Plan,
    images: List[str],
    model: Optional[str] = None,
    creds: Optional[Credentials] = None,
) -> str:
    """Run the Generator through LangGraph on an APPROVED plan and return HTML."""
    result = GENERATOR_GRAPH.invoke(
        {"plan": plan, "images": images, "model": model, "creds": creds}
    )
    return result["html"]
