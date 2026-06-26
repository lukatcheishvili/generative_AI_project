from typing import TypedDict, Annotated, Sequence
import operator
from langchain_core.messages import BaseMessage

class HotelIntelligenceState(TypedDict):
    """
    Graph state for the Hotel Market & Acquisition Intelligence System.
    """
    user_query: str
    task_type: str  # "acquisition" or "pricing"
    
    # Using operator.add to append strings if needed, or just replace.
    # We will replace them to keep it simple, except for messages.
    reputation_data: str
    market_data: str
    preliminary_report: str
    
    human_feedback: str
    final_dossier: str
    
    messages: Annotated[Sequence[BaseMessage], operator.add]
