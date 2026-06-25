# Support Triage Agent — Generative AI Final Project

A **multi-agent customer-support triage system** built with **LangGraph**. It takes a raw
customer ticket and runs it through a real agent workflow — classification, routing to a
specialist agent, tool calls against (mock) backends, a critic/refinement loop, and a
**human approval gate** before any reply is "sent."

The project is deliberately narrow so it actually works end to end, while still exercising
every architectural concept the course cares about: **routing, tool use, state/memory,
conditional logic, a refinement loop, and human-in-the-loop**.

---

## Project requirements

Build a working **Gen AI system that solves a real business problem**. The emphasis is on the
**business problem + backend/agent logic** — not the frontend.

**Scope**
- The system may be single-agent or multi-agent, and may use tools, memory, routing, loops, or
  human approval as the use case requires.
- Any tools or frameworks are allowed — raw API calls, LangChain, LangGraph, or any combination.
- A frontend is optional. Something simple (e.g. React) is fine; frontend sophistication is **not** evaluated.

**Deliverable: a team presentation (20–30 min)** covering:
- the business problem and why it matters,
- the AI/agent system that was built,
- the technical implementation,
- how the system works end to end.
- At least one member must present **both** the business problem **and** the technical solution.

**What the instructor evaluates** — that you understand the architecture underneath:
why single-agent vs multi-agent, how tools are called, how routing works, whether you use
state/memory, whether human-in-the-loop is needed, and why the graph/workflow is structured
the way it is. A strong project has a clear use case, a real reason agents are useful, and a
workflow that is more than one prompt — combining tool use, structured flow, conditional
logic, a refinement loop, and/or a review/approval step. Pick something narrow enough to
finish, easy to explain, and demo something reliable rather than flashy.

### How this project meets them

| Requirement | Where it's satisfied |
|---|---|
| Real business problem | Support-ticket triage + drafting with a human approval gate (see below) |
| Backend / agent logic is the focus | All logic in `src/`; no UI to distract from the graph |
| Single- vs multi-agent (justified) | Multi-agent: router + 4 specialists + critic — rationale in `docs/architecture.md` §1 |
| Tool calls | `lookup_order`, `search_kb`, `check_refund_policy` in `src/tools.py` |
| Routing | Conditional edges from `router` → specialist (`src/graph.py`) |
| State / memory | Typed `SupportState` + `MemorySaver` checkpointer per thread |
| Conditional logic + refinement loop | `critic` → `revise` → `critic`, bounded by `MAX_REVISIONS` |
| Review / approval (human-in-the-loop) | `interrupt_before=["human_approval"]` pauses before sending |
| Workflow is more than one prompt | 9-node graph with routing, a loop, and an interrupt |
| Narrow, reliable, easy to explain | Runs offline in `mock` mode; **12 passing tests**; node-by-node script in `docs/` |
| Framework freedom | Built on LangGraph; provider-agnostic across OpenAI / Anthropic / mock |

---

## The business problem

Support teams drown in repetitive tickets. Triage (reading, categorizing, looking up the
order, drafting a first response) is slow and inconsistent, but fully automating replies is
risky — a wrong refund or a bad answer costs money and trust.

**The wedge:** automate the *triage and drafting*, keep a *human in the loop* for the final
send. The agent does the 80% that is mechanical; the human approves or edits in seconds.

## Why agents (not a single prompt)

A single prompt can't reliably *look up an order*, *apply a refund policy*, *decide which
specialist logic applies*, *self-review*, and *pause for a human*. Those are distinct
responsibilities with branching and loops between them — exactly what an agent graph models.
Each node is small and independently justifiable, which is the point.

---

## Architecture at a glance

```
START
  → router            classify ticket  →  billing | refund | technical | general
  → specialist        calls its tools, drafts a reply
  → critic            reviews the draft
        ├─ REVISE ──► revise ──► critic        (bounded refinement loop