"""
The nodes of the graph.

Each function below is a LangGraph node: it takes the current SupportState and returns a
partial state update. Keeping nodes small and single-purpose is what makes the workflow
explainable ("here is exactly what each step does and why").

Node roster
-----------
- router:           LLM classifies the ticket -> billing | refund | technical | general
- billing_agent:    looks up the order, drafts a billing-specific reply
- refund_agent:     checks refund policy (tool), drafts a refund decision
- technical_agent:  searches the KB (tool), drafts troubleshooting steps
- general_agent:    fallback, drafts a general reply
- critic:           reviews the draft; either APPROVED or sends feedback (refinement loop)
- finalize:         applies any human edit and produces the reply that gets "sent"
"""

from __future__ import annotations

from .config import get_llm, normalize_category
from .state import SupportState
from .tools import lookup_order, search_kb, check_refund_policy, extract_order_id

MAX_REVISIONS = 2  # bound the refinement loop so it can never spin forever


# --------------------------------------------------------------------------- #
# Routing                                                                     #
# --------------------------------------------------------------------------- #
def router(state: SupportState) -> dict:
    llm = get_llm()
    ticket = state["ticket"]
    system = (
        "You are a support router. Classify the ticket into exactly one category: "
        "billing, refund, technical, or general. Reply with only the category word."
    )
    raw = llm.complete(system, ticket)
    category = normalize_category(raw)
    order_id = state.get("order_id") or extract_order_id(ticket)
    return {
        "category": category,
        "order_id": order_id,
        "log": [f"router -> category={category}, order_id={order_id or 'n/a'}"],
    }


def route_decision(state: SupportState) -> str:
    """Conditional edge: map category -> the specialist node name."""
    return {
        "billing": "billing_agent",
        "refund": "refund_agent",
        "technical": "technical_agent",
        "general": "general_agent",
    }[state["category"]]


# --------------------------------------------------------------------------- #
# Specialist agents (each calls its tools, then drafts)                        #
# --------------------------------------------------------------------------- #
def _draft_reply(context: str) -> str:
    llm = get_llm()
    system = (
        "You are a senior customer-support specialist. Using the case context provided, "
        "write a concise, empathetic reply to the customer with a clear resolution and next steps."
    )
    return llm.complete(system, context)


def billing_agent(state: SupportState) -> dict:
    order = lookup_order(state.get("order_id", ""))
    kb = search_kb("subscription billing " + state["ticket"])
    context = f"Customer ticket: {state['ticket']}\n{order}\n{kb}"
    draft = _draft_reply(context)
    return {"tool_results": [order, kb], "draft": draft,
            "log": ["billing_agent -> called lookup_order + search_kb, drafted reply"]}


def refund_agent(state: SupportState) -> dict:
    order = lookup_order(state.get("order_id", ""))
    policy = check_refund_policy(state.get("order_id", ""))
    context = f"Customer ticket: {state['ticket']}\n{order}\n{policy}"
    draft = _draft_reply(context)
    return {"tool_results": [order, policy], "draft": draft,
            "log": ["refund_agent -> called lookup_order + check_refund_policy, drafted reply"]}


def technical_agent(state: SupportState) -> dict:
    kb = search_kb(state["ticket"])
    context = f"Customer ticket: {state['ticket']}\n{kb}"
    draft = _draft_reply(context)
    return {"tool_results": [kb], "draft": draft,
            "log": ["technical_agent -> called search_kb, drafted reply"]}


def general_agent(state: SupportState) -> dict:
    kb = search_kb(state["ticket"])
    context = f"Customer ticket: {state['ticket']}\n{kb}"
    draft = _draft_reply(context)
    return {"tool_results": [kb], "draft": draft,
            "log": ["general_agent -> drafted general reply"]}


# --------------------------------------------------------------------------- #
# Refinement loop                                                             #
# --------------------------------------------------------------------------- #
def critic(state: SupportState) -> dict:
    llm = get_llm()
    system = (
        "You are a QA critic reviewing a support reply. If it is empathetic, specific, and "
        "actionable, reply exactly 'APPROVED'. Otherwise reply 'REVISE:' followed by one fix."
    )
    feedback = llm.complete(system, state.get("draft", ""))
    return {
        "critique": feedback,
        "revisions": state.get("revisions", 0) + 1,
        "log": [f"critic -> {feedback[:60]}"],
    }


def critic_decision(state: SupportState) -> str:
    """Conditional edge: loop back to revise, or move on to human approval."""
    approved = state.get("critique", "").strip().upper().startswith("APPROVED")
    if approved or state.get("revisions", 0) >= MAX_REVISIONS:
        return "human_approval"
    return "revise"


def revise(state: SupportState) -> dict:
    """Re-draft using the critic's feedback — this is the loop body."""
    llm = get_llm()
    system = (
        "You are a senior support specialist. Improve the draft using the critique. "
        "Return only the improved reply."
    )
    context = f"Draft:\n{state.get('draft','')}\n\nCritique:\n{state.get('critique','')}"
    new_draft = llm.complete(system, context)
    return {"draft": new_draft, "log": ["revise -> re-drafted using critic feedback"]}


# --------------------------------------------------------------------------- #
# Human-in-the-loop + finalize                                                #
# --------------------------------------------------------------------------- #
def human_approval(state: SupportState) -> dict:
    """
    A pass-through node. The graph is compiled with `interrupt_before=['human_approval']`,
    so execution PAUSES before this runs and returns control to the caller (a human).
    The human approves as-is or supplies `human_edit`, then the graph is resumed.
    """
    return {"log": ["human_approval -> awaiting human decision (interrupt)"]}


def finalize(state: SupportState) -> dict:
    reply = state.get("human_edit") or state.get("draft", "")
    source = "human-edited" if state.get("human_edit") else "agent draft (approved)"
    return {
        "final_reply": reply,
        "approved": True,
        "log": [f"finalize -> sent {source}"],
    }
