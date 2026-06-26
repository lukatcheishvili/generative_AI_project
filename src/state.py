from typing import TypedDict


class PipelineState(TypedDict, total=False):
    """Shared state threaded through the BrewPage LangGraph pipeline."""
    shop: dict
    images: list
    strategy: dict
    html: str
