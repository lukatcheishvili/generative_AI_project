"""
Provider-agnostic LLM layer.

Every agent/node talks to the model through a single seam: `LLMClient.complete(system, user)`.
This is the whole point of the abstraction — the *graph* never changes; we just swap the
model behind it. Three providers are supported:

  - "openai"    -> langchain-openai ChatOpenAI
  - "anthropic" -> langchain-anthropic ChatAnthropic
  - "mock"      -> deterministic, no API key, no network. Used for tests/demos so the
                   architecture (routing, tools, loops, human-in-the-loop) can be run and
                   graded without spending tokens.

Select the provider with the LLM_PROVIDER env var (see .env.example).
"""

from __future__ import annotations

import os
import re

from dotenv import load_dotenv

load_dotenv()


# --------------------------------------------------------------------------- #
# Mock model — deterministic responses keyed off the *role* of the system msg  #
# --------------------------------------------------------------------------- #
class _MockLLM:
    """A tiny rule-based stand-in for a real chat model.

    It inspects the system prompt to decide what kind of output the caller wants
    (classification, a drafted reply, or a critique) and returns something sensible.
    No network, fully deterministic — so CI and demos are reproducible.
    """

    CATEGORIES = ("billing", "refund", "technical", "general")

    def complete(self, system: str, user: str) -> str:
        s = system.lower()
        if "classify" in s or "route" in s:
            return self._classify(user)
        if "critic" in s or "critique" in s or "review" in s:
            return self._critique(user)
        return self._draft(user)

    def _classify(self, text: str) -> str:
        t = text.lower()
        rules = {
            "refund": ("refund", "money back", "return", "cancel my order"),
            "billing": ("charge", "invoice", "billing", "payment", "subscription", "overcharged"),
            "technical": ("error", "bug", "crash", "not working", "broken", "login", "password", "500"),
        }
        for category, kws in rules.items():
            if any(k in t for k in kws):
                return category
        return "general"

    def _critique(self, text: str) -> str:
        # Approve once the draft is substantive and references the customer's case.
        draft = text.lower()
        if len(draft) < 60:
            return "REVISE: The reply is too short; add specifics and next steps."
        if "sorry" not in draft and "apolog" not in draft and "thank" not in draft:
            return "REVISE: Add an empathetic opening before the resolution."
        return "APPROVED"

    def _draft(self, user: str) -> str:
        # Pull any tool context the node passed in and echo a clean, templated reply.
        ctx = user.strip()
        return (
            "Hi there, thanks for reaching out and sorry for the trouble. "
            "Here's what I found and how we'll fix it:\n\n"
            f"{ctx}\n\n"
            "If anything above looks off, just reply here and we'll keep helping. "
            "— Support Team"
        )


# --------------------------------------------------------------------------- #
# Real providers                                                              #
# --------------------------------------------------------------------------- #
class _LangChainLLM:
    """Adapter so a langchain chat model exposes the same .complete(system, user)."""

    def __init__(self, model):
        self._model = model

    def complete(self, system: str, user: str) -> str:
        from langchain_core.messages import HumanMessage, SystemMessage

        resp = self._model.invoke([SystemMessage(content=system), HumanMessage(content=user)])
        return resp.content if hasattr(resp, "content") else str(resp)


def get_llm():
    """Factory: return an object exposing .complete(system, user) -> str."""
    provider = os.getenv("LLM_PROVIDER", "mock").strip().lower()

    if provider == "mock":
        return _MockLLM()

    if provider == "openai":
        from langchain_openai import ChatOpenAI

        model = ChatOpenAI(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            temperature=0.3,
            api_key=os.getenv("OPENAI_API_KEY"),
        )
        return _LangChainLLM(model)

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        model = ChatAnthropic(
            model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
            temperature=0.3,
            api_key=os.getenv("ANTHROPIC_API_KEY"),
        )
        return _LangChainLLM(model)

    raise ValueError(f"Unknown LLM_PROVIDER={provider!r}. Use openai | anthropic | mock.")


def normalize_category(raw: str) -> str:
    """Coerce a model's free-text classification into a known route."""
    raw = (raw or "").lower()
    for cat in _MockLLM.CATEGORIES:
        if re.search(rf"\b{cat}\b", raw):
            return cat
    return "general"
