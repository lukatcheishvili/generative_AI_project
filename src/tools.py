"""
Tools the specialist agents can call.

These are deliberately simple, deterministic stand-ins for real backends (an orders DB,
a billing system, a knowledge base). In a production system each would be an API call;
here they return canned data so the *agent logic* — deciding which tool to call and how to
use the result — is the thing on display, and so the demo runs offline.

Each tool returns a short human-readable string that gets appended to state["tool_results"].
"""

from __future__ import annotations

import re

# --- fake backends -------------------------------------------------------- #
_ORDERS = {
    "1001": {"item": "Wireless Headphones", "status": "delivered", "days_ago": 5, "amount": 89.0},
    "1002": {"item": "Standing Desk", "status": "shipped", "days_ago": 2, "amount": 240.0},
    "1003": {"item": "USB-C Cable", "status": "processing", "days_ago": 0, "amount": 12.0},
}

_KB = {
    "login": "Reset your password at /account/reset. Clear cookies if the reset email is delayed.",
    "password": "Reset your password at /account/reset. Links expire after 30 minutes.",
    "error 500": "A 500 usually means a transient server issue. Retry in 5 minutes; escalate if it persists.",
    "shipping": "Standard shipping is 3-5 business days. Tracking appears once the carrier scans the parcel.",
    "subscription": "Subscriptions renew monthly. Manage or cancel under Account > Billing.",
}

_REFUND_WINDOW_DAYS = 30


def extract_order_id(text: str) -> str:
    """Pull a 4-digit order id out of free text, if present."""
    m = re.search(r"\b(\d{4})\b", text or "")
    return m.group(1) if m else ""


def lookup_order(order_id: str) -> str:
    """Tool: fetch order status from the (fake) orders DB."""
    o = _ORDERS.get(order_id)
    if not o:
        return f"[order_lookup] No order found for id {order_id or '(none provided)'}."
    return (
        f"[order_lookup] Order {order_id}: {o['item']}, status={o['status']}, "
        f"placed {o['days_ago']} day(s) ago, amount ${o['amount']:.2f}."
    )


def search_kb(query: str) -> str:
    """Tool: naive knowledge-base search; returns the best matching article."""
    q = (query or "").lower()
    for key, article in _KB.items():
        if key in q:
            return f"[kb] {article}"
    return "[kb] No exact article found; routed to general guidance."


def check_refund_policy(order_id: str) -> str:
    """Tool: decide refund eligibility from order age vs. the refund window."""
    o = _ORDERS.get(order_id)
    if not o:
        return f"[refund_policy] Cannot assess: order {order_id or '(none)'} not found."
    eligible = o["days_ago"] <= _REFUND_WINDOW_DAYS
    verdict = "ELIGIBLE" if eligible else "NOT eligible"
    return (
        f"[refund_policy] Order {order_id} is {verdict} for refund "
        f"({o['days_ago']}d old vs {_REFUND_WINDOW_DAYS}d window), amount ${o['amount']:.2f}."
    )


# Registry — handy for documentation/inspection in the presentation.
TOOLS = {
    "lookup_order": lookup_order,
    "search_kb": search_kb,
    "check_refund_policy": check_refund_policy,
}
