"""
BrewPage pipeline, expressed as a LangGraph graph.

Two nodes, run in a straight line:
  strategist -> generator

The graph is compiled once and reused; frontend/app.py streams it
node-by-node so the UI can show per-step progress.
"""

from langgraph.graph import StateGraph, START, END

from src.agents import strategist_node, generator_node
from src.state import PipelineState

STEP_LABELS = {
    "strategist": "1/2 — Strategist is making the marketing decisions",
    "generator": "2/2 — Generator is building the landing page",
}

_pipeline = None


def build_graph():
    graph = StateGraph(PipelineState)
    graph.add_node("strategist", strategist_node)
    graph.add_node("generator", generator_node)
    graph.add_edge(START, "strategist")
    graph.add_edge("strategist", "generator")
    graph.add_edge("generator", END)
    return graph.compile()


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        _pipeline = build_graph()
    return _pipeline
