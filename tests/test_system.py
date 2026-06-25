"""
Tests run entirely in mock mode (LLM_PROVIDER=mock) — no API key, no network.
They prove the architecture works: routing, tool calls, the refinement loop, the
human-in-the-loop interrupt, and human-edit override.
"""

import os
import uuid

os.environ["LLM_PROVIDER"] = "mock"

from src import tools
from src.config import normalize_category
from src.graph import build_graph


def _run_to_interrupt(ticket):
    app = build_graph()
    cfg = {"configurable": {"thread_id": str(uuid.uuid4())}}
    app.invoke({"ticket": ticket, "revisions": 0}, config=cfg)
    return app, cfg


# --- tools ----------------------------------------------------------------- #
def test_order_lookup_found():
    assert "Standing Desk" in tools.lookup_order("1002")


def test_order_lookup_missing():
    assert "No order found" in tools.lookup_order("9999")


def test_refund_policy_eligible():
    assert "ELIGIBLE" in tools.check_refund_policy("1002")


def test_extract_order_id():
    assert tools.extract_order_id("charged twice for order 1001") == "1001"


def test_normalize_category():
    assert normalize_category("this is a REFUND request") == "refund"
    assert normalize_category("nonsense") == "general"


# --- routing --------------------------------------------------------------- #
def test_routes_refund():
    app, cfg = _run_to_interrupt("I want a refund for order 1002")
    assert app.get_state(cfg).values["category"] == "refund"


def test_routes_technical():
    app, cfg = _run_to_interrupt("I get a 500 error when I login")
    assert app.get_state(cfg).values["category"] == "technical"


def test_routes_billing():
    app, cfg = _run_to_interrupt("I was overcharged on my subscription invoice")
    assert app.get_state(cfg).values["category"] == "billing"


# --- human-in-the-loop ----------------------------------------------------- #
def test_interrupt_pauses_before_send():
    app, cfg = _run_to_interrupt("refund for order 1002")
    state = app.get_state(cfg)
    # Graph paused: there is a draft but nothing finalized yet.
    assert state.values.get("draft")
    assert not state.values.get("final_reply")
    assert state.next == ("human_approval",)


def test_resume_approves_and_finalizes():
    app, cfg = _run_to_interrupt("refund for order 1002")
    app.invoke(None, config=cfg)  # resume = approve
    assert app.get_state(cfg).values["final_reply"]


def test_human_edit_overrides_draft():
    app, cfg = _run_to_interrupt("refund for order 1002")
    app.update_state(cfg, {"human_edit": "Custom human reply."})
    app.invoke(None, config=cfg)
    assert app.get_state(cfg).values["final_reply"] == "Custom human reply."


# --- refinement loop bound ------------------------------------------------- #
def test_revision_loop_is_bounded():
    app, cfg = _run_to_interrupt("refund for order 1002")
    assert app.get_state(cfg).values.get("revisions", 0) <= 2
