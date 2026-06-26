"""
BrewPage pipeline, expressed as a LangGraph graph.

Generation pipeline (two nodes, run in a straight line):
  strategist -> generator

Editor loop (one node, invoked once per revision from the UI):
  editor

Each graph is compiled once and reused; frontend/app.py streams/invokes them
so the UI can show per-step progress and apply feedback-driven revisions.
"""

from langgraph.graph import StateGraph, START, END

from src.agents import strategist_node, generator_node, editor_node
from src.state import PipelineState

STEP_LABELS = {
    "strategist": "1/2 — Strategist is making the marketing decisions",
    "generator": "2/2 — Generator is building the landing page",
}

_pipeline = None
_editor_pipeline = None


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


def build_editor_graph():
    graph = StateGraph(PipelineState)
    graph.add_node("editor", editor_node)
    graph.add_edge(START, "editor")
    graph.add_edge("editor", END)
    return graph.compile()


def get_editor_pipeline():
    global _editor_pipeline
    if _editor_pipeline is None:
        _editor_pipeline = build_editor_graph()
    return _editor_pipeline
