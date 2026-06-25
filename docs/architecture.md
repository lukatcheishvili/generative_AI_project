# Architecture & Design Justification

This document is the script for the technical half of the presentation. It explains **every
node, tool, and design choice** so you can justify the graph the instructor will ask about.

## 1. Why multi-agent instead of single-agent

A single agent with one big prompt would have to classify, fetch data, apply policy,
self-review, and decide when to involve a human — all at once. That makes behavior hard to
predict and impossible to test in isolation.

We instead use a **supervisor/router + specialists** pattern:

- a **router** does one job: classify and dispatch;
- each **specialist** owns one domain and only the tools relevant to it;
- a **critic** enforces quality independently of the agent that wrote the draft.

Benefit: each node is small, separately testable, and individually justifiable. That
separation is exactly what the loop, routing, and human-gate edges connect.

## 2. The graph

```
START → router → (conditional route) → specialist → critic
                                                       ├─ revise → critic   (loop)
                                                       └─ human_approval (INTERRUPT) → finalize → END
```

### Nodes

| Node | Responsibility | Tools | Output to state |
|---|---|---|---|
| `router` | classify ticket, extract order id | — | `category`, `order_id` |
| `billing_agent` | billing issues | `lookup_order`, `search_kb` | `draft`, `tool_results` |
| `refund_agent` | refund decisions | `lookup_order`, `check_refund_policy` | `draft`, `tool_results` |
| `technical_agent` | troubleshooting | `search_kb` | `draft`, `tool_results` |
| `general_agent` | fallback | `search_kb` | `draft` |
| `critic` | QA review of the draft | — | `critique`, `revisions++` |
| `revise` | re-draft from critique | — | improved `draft` |
| `human_approval` | pause point (interrupt) | — | — |
| `finalize` | apply human edit, send | — | `final_reply`, `approved` |

## 3. How routing works

`graph.py` wires a **conditional edge** out of `router`:

```python
g.add_conditional_edges("router", agents.route_decision, {
    "billing_agent": "billing_agent",
    "refund_agent": "refund_agent",
    "technical_agent": "technical_agent",
    "general_agent": "general_agent",
})
```

`route_decision(state)` reads `state["category"]` (set by the router using the LLM) and
returns the next node's name. The router's LLM output is normalized with
`normalize_category()` so a chatty model ("This looks like a refund") still maps to a clean
route. This is **dynamic, model-driven routing**, not a hard-coded if-chain on raw text.

## 4. How tools are called

Tools live in `src/tools.py` as plain, deterministic functions (stand-ins for an orders DB,
KB, and billing system). A specialist node decides *which* tools to call and *how to use the
result*, then folds the output into the draft context:

```python
def refund_agent(state):
    order  = lookup_order(state["order_id"])         # tool 1
    policy = check_refund_policy(state["order_id"])  # tool 2
    draft  = _draft_reply(f"{state['ticket']}\n{order}\n{policy}")
    return {"tool_results": [order, policy], "draft": draft}
```

Tool outputs are appended to `state["tool_results"]` (a list with an `add` reducer), giving a
clean audit trail of what the agent looked at — useful in the demo.

## 5. State and memory

`SupportState` (a `TypedDict`) is the single object passed between nodes — it is the system's
working memory for one ticket. Two fields use **reducers** (`Annotated[list, add]`) so
parallel/sequential writes append instead of overwrite (`tool_results`, `log`).

Persistence comes from the **`MemorySaver` checkpointer**, attached at compile time and keyed
by `thread_id`. This is what makes two things possible:

1. **Human-in-the-loop:** the run can pause and be resumed later with full state intact.
2. **Multi-turn memory:** the same `thread_id` resumes the same conversation state.

## 6. The refinement loop

After a specialist drafts, `critic` reviews it. `critic_decision` is a conditional edge:

```python
def critic_decision(state):
    approved = state["critique"].upper().startswith("APPROVED")
    if approved or state["revisions"] >= MAX_REVISIONS:
        return "human_approval"
    return "revise"        # loop back
```

`revise → critic` forms the loop. It is **bounded** by `MAX_REVISIONS = 2` so it can never
spin forever — a deliberate safety/cost choice you can defend.

## 7. Human-in-the-loop

The graph is compiled with:

```python
g.compile(checkpointer=MemorySaver(), interrupt_before=["human_approval"])
```

`interrupt_before` makes execution **stop before** the `human_approval` node and return
control to the caller. In `main.py`:

1. `app.invoke(...)` runs up to the interrupt and returns the proposed draft.
2. The human approves, edits (`update_state({"human_edit": ...})`), or rejects.
3. `app.invoke(None, config=thread)` **resumes** from the checkpoint into `finalize`.

This is the core risk control: **no reply is ever sent without a human pass**, but the human
only spends seconds because the agent did the triage and drafting.

## 8. Provider-agnostic design

Every node calls the model through one method: `LLMClient.complete(system, user)`. Swapping
`LLM_PROVIDER` between `openai`, `anthropic`, and `mock` changes the model — never the graph.
`mock` is a deterministic, offline stand-in so the architecture is testable in CI and
demoable without spending tokens.

## 9. What we'd add for production

- Replace mock tools with real API clients (orders DB, Zendesk/Stripe).
- Swap `MemorySaver` for a persistent checkpointer (e.g. SQLite/Postgres) so threads survive
  restarts.
- Add observability (LangSmith) and guardrails on the refund tool (caps, fraud checks).
- Escalation routing for low-confidence classifications.
