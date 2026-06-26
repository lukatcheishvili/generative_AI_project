from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from src.state import HotelIntelligenceState
from src.agents import (
    orchestrator_node,
    reputation_analyst_node,
    market_analyst_node,
    financial_evaluator_node,
    synthesizer_node
)

def build_graph():
    """
    Assembles the LangGraph with parallel execution and Human-in-the-Loop.
    """
    builder = StateGraph(HotelIntelligenceState)
    
    # 1. Add Nodes
    builder.add_node("orchestrator", orchestrator_node)
    builder.add_node("reputation_analyst", reputation_analyst_node)
    builder.add_node("market_analyst", market_analyst_node)
    builder.add_node("financial_evaluator", financial_evaluator_node)
    builder.add_node("synthesizer", synthesizer_node)
    
    # 2. Add Edges (Sequential & Parallel)
    # Orchestrator goes to BOTH reputation and market analysts (Parallel execution)
    builder.add_edge(START, "orchestrator")
    builder.add_edge("orchestrator", "reputation_analyst")
    builder.add_edge("orchestrator", "market_analyst")
    
    # Both parallel nodes converge into the financial evaluator
    # LangGraph handles this automatically: a node waits for all incoming edges to complete
    # However, in LangGraph, parallel branches converge cleanly if defined correctly.
    # To be explicit, we route both to financial_evaluator.
    builder.add_edge("reputation_analyst", "financial_evaluator")
    builder.add_edge("market_analyst", "financial_evaluator")
    
    # Financial evaluator goes to synthesizer
    builder.add_edge("financial_evaluator", "synthesizer")
    builder.add_edge("synthesizer", END)
    
    # 3. Setup Checkpointer and Human-in-the-loop (HITL)
    memory = MemorySaver()
    
    # We pause execution *before* the synthesizer to allow human review
    graph = builder.compile(
        checkpointer=memory,
        interrupt_before=["synthesizer"]
    )
    
    return graph
