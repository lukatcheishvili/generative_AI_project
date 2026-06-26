from typing import TypedDict


class PipelineState(TypedDict, total=False):
    """Shared state threaded through the BrewPage LangGraph pipeline."""
    shop: dict
    images: list
    new_images: list
    strategy: dict
    html_template: str
    feedback: str
