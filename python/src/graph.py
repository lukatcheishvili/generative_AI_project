"""
The PageForge pipeline, expressed as a LangGraph graph:

    START -> strategist -> [HUMAN APPROVAL PAUSE] -> generator -> END

This is the heart of the app's "agentic + human-in-the-loop" design. The graph
is compiled with a checkpointer and `interrupt_before=["generator"]`, so after
the Strategist writes the plan the graph PAUSES — LangGraph persists the state,
the UI shows the plan for the human to review/edit, and only on resume does the
Generator run. Unlike a one-shot prompt, the strategic decisions are made (and
approved) before — and independently of — the page build.

Two entry points:
  - `get_pipeline()`   -> the interactive graph WITH the approval gate (used by the app).
  - `get_straight_through()` -> the same graph WITHOUT the interrupt (used by the CLI).
"""

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from src.agents import generator_node, strategist_node
from src.state import PipelineState

STEP_LABELS = {
    "strategist": "1/2 — Strategist is making the marketing decisions",
    "generator": "2/2 — Generator is building the landing page",
}


def _base_graph() -> StateGraph:
    graph = StateGraph(PipelineState)
    graph.add_node("strategist", strategist_node)
    graph.add_node("generator", generator_node)
    graph.add_edge(START, "strategist")
    graph.add_edge("strategist", "generator")
    graph.add_edge("generator", END)
    return graph


_pipeline = None
_straight = None


def get_pipeline():
    """Interactive graph: pauses before the generator for human approval."""
    global _pipeline
    if _pipeline is None:
        _pipeline = _base_graph().compile(
            checkpointer=MemorySaver(),
            interrupt_before=["generator"],
        )
    return _pipeline


def get_straight_through():
    """Non-interactive graph: strategist -> generator with no pause (CLI / tests)."""
    global _straight
    if _straight is None:
        _straight = _base_graph().compile()
    return _straight
