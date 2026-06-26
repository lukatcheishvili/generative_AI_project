from langchain_core.messages import SystemMessage, HumanMessage
from src.state import HotelIntelligenceState
from src.config import get_llm
from src.tools import search_market_data, fetch_hotel_reviews

def _get_text(content):
    if isinstance(content, list):
        return " ".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
    return str(content)

def orchestrator_node(state: HotelIntelligenceState) -> dict:
    """
    Analyzes the user query to determine task type and initial setup.
    """
    llm = get_llm()
    query = state.get("user_query", "")
    
    prompt = f"""You are the Orchestrator for a Hotel Market & Acquisition Intelligence System.
    Determine if the user is asking for:
    1. 'acquisition' (evaluating a property to buy/acquire)
    2. 'pricing' (analyzing market and competitors for dynamic pricing)
    
    User Query: {query}
    
    Respond with ONLY the word 'acquisition' or 'pricing'.
    """
    response = llm.invoke([HumanMessage(content=prompt)])
    task_type = _get_text(response.content).strip().lower()
    if "acquisition" not in task_type and "pricing" not in task_type:
        task_type = "pricing"  # default
        
    return {"task_type": task_type}

def reputation_analyst_node(state: HotelIntelligenceState) -> dict:
    """
    Uses the fetch_hotel_reviews tool to gather reputation data.
    """
    llm = get_llm().bind_tools([fetch_hotel_reviews])
    query = state.get("user_query", "")
    
    sys_msg = SystemMessage(content="You are the Reputation Analyst. Use tools to fetch hotel reviews and summarize the sentiment, operational red flags, and CapEx needs.")
    response = llm.invoke([sys_msg, HumanMessage(content=query)])
    
    # We will simulate tool execution here for simplicity, or we can use standard ToolNode.
    # To keep it completely LangGraph native, we should ideally use ToolNode, 
    # but since this is an MVP without complex tool loops, we can just call it manually or rely on a standard ReAct agent.
    # For this script, we'll just force the tool call if needed or do a basic extraction.
    
    # Let's do a simple manual invocation if tool calls exist:
    reputation_data = "No reputation data gathered."
    if hasattr(response, "tool_calls") and response.tool_calls:
        tool_call = response.tool_calls[0]
        if tool_call["name"] == "fetch_hotel_reviews":
            args = tool_call["args"]
            reputation_data = fetch_hotel_reviews.invoke(args)
            # Re-invoke to summarize
            summary_resp = get_llm().invoke([
                sys_msg, 
                HumanMessage(content=f"Here are the reviews: {reputation_data}\nSummarize them for our intelligence report.")
            ])
            reputation_data = _get_text(summary_resp.content)
    else:
        # Fallback if it just answered
        reputation_data = _get_text(response.content)
        
    return {"reputation_data": reputation_data}

def market_analyst_node(state: HotelIntelligenceState) -> dict:
    """
    Uses the search_market_data tool to gather market and competitor info.
    """
    llm = get_llm().bind_tools([search_market_data])
    query = state.get("user_query", "")
    
    sys_msg = SystemMessage(content="You are the Market Analyst. Use your search tool to find local events, competitor pricing, and market trends.")
    response = llm.invoke([sys_msg, HumanMessage(content=query)])
    
    market_data = "No market data gathered."
    if hasattr(response, "tool_calls") and response.tool_calls:
        tool_call = response.tool_calls[0]
        if tool_call["name"] == "search_market_data":
            args = tool_call["args"]
            market_data = search_market_data.invoke(args)
            summary_resp = get_llm().invoke([
                sys_msg, 
                HumanMessage(content=f"Here is the market data: {market_data}\nSummarize it for our intelligence report.")
            ])
            market_data = _get_text(summary_resp.content)
    else:
        market_data = _get_text(response.content)
        
    return {"market_data": market_data}

def financial_evaluator_node(state: HotelIntelligenceState) -> dict:
    """
    Combines reputation and market data into a preliminary financial/risk report.
    """
    llm = get_llm()
    task = state.get("task_type", "pricing")
    rep = state.get("reputation_data", "")
    mkt = state.get("market_data", "")
    
    sys_msg = SystemMessage(content=f"You are the Financial Evaluator. Your task is {task}. Synthesize the reputation and market data into a preliminary assessment.")
    user_msg = HumanMessage(content=f"Reputation Data:\\n{rep}\\n\\nMarket Data:\\n{mkt}")
    
    response = llm.invoke([sys_msg, user_msg])
    return {"preliminary_report": _get_text(response.content)}

def synthesizer_node(state: HotelIntelligenceState) -> dict:
    """
    Takes the preliminary report + human feedback and produces the final dossier.
    """
    llm = get_llm()
    report = state.get("preliminary_report", "")
    feedback = state.get("human_feedback", "")
    
    sys_msg = SystemMessage(content="You are the Executive Synthesizer. Finalize the intelligence dossier incorporating the human feedback.")
    user_msg = HumanMessage(content=f"Preliminary Report:\\n{report}\\n\\nHuman Feedback:\\n{feedback}\\n\\nPlease write the final, polished executive dossier.")
    
    response = llm.invoke([sys_msg, user_msg])
    return {"final_dossier": _get_text(response.content)}
