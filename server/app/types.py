"""Shared types for the brief -> plan -> landing-page flow.

A 1:1 port of web/lib/types.ts. Field names are kept EXACTLY as the TypeScript
frontend expects them on the wire — note the deliberate mix of casing:
`businessType` and `framerId` are camelCase, while the strategy fields stay
snake_case. Pydantic serialises these names verbatim, so the React UI (which
reads `plan.framerId`, `business.businessType`, `strategy.target_customer`, …)
keeps working without any change.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class Shop(BaseModel):
    """Business basics the Strategist extracts from the user's free-form brief."""

    name: str
    businessType: str
    location: str
    address: Optional[str] = ""
    goal: str


class Strategy(BaseModel):
    """The marketing decisions the Strategist makes."""

    positioning: str
    target_customer: str
    value_proposition: str
    tone: str
    conversion_goal: str
    key_messages: List[str]


class Plan(BaseModel):
    """What Plan Mode shows the user to approve before anything is generated."""

    business: Shop
    strategy: Strategy
    # The chosen design system (app/framers.py). Picked by the Strategist from
    # the brief, with a random fallback; editable in the Plan card.
    framerId: str


class Credentials(BaseModel):
    """Optional per-request credential overrides (from the Settings panel) so a
    user can run the agents on their OWN keys instead of the server's defaults.

    Keys mirror the JSON the frontend sends (web/app/page.tsx →
    credentialsFromSettings): provider / geminiApiKey / vertexProject /
    vertexLocation / vertexServiceAccountJson.
    """

    model_config = ConfigDict(extra="ignore")

    provider: Optional[str] = None
    geminiApiKey: Optional[str] = None
    vertexProject: Optional[str] = None
    vertexLocation: Optional[str] = None
    vertexServiceAccountJson: Optional[str] = None


BUSINESS_GOALS = [
    "Get people to visit in person",
    "Drive online orders / bookings",
    "Generate leads / enquiries",
    "Sign up / subscribe",
    "Book a consultation / appointment",
]

# Google/Vertex models offered in the picker (kept in sync with web/lib/types.ts).
MODELS = [
    {"id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash"},
    {"id": "gemini-2.5-pro", "label": "Gemini 2.5 Pro"},
    {"id": "gemini-2.0-flash", "label": "Gemini 2.0 Flash"},
]

DEFAULT_MODEL = "gemini-2.5-flash"

PLAN_STEP = "Strategist is analysing your business and planning the strategy…"
BUILD_STEP = "Generator is building your landing page…"
