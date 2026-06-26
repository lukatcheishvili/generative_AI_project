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

These are the **official requirements** from the *Generative AI — Final Project Guidelines*
(IE University). The deliverable is a **functional MVP plus a final presentation** that solves a
real-world business problem with a GenAI / agentic solution. Both an analytical backend **and**
a user-facing frontend are required.

**Backend (the AI model)**
- Must be powered by a **GenAI or agentic architecture**.

**Frontend & integration (required — not optional)**
- You **must** build an interface that lets a **non-technical user** interact with the model.
  Vibe-coding tools (Cursor, v0, Bolt.new, Streamlit) are explicitly encouraged to build it fast.
- **Seamless end-to-end integration is a graded pillar:** the frontend must pass user input to the
  GenAI backend and display results in **real time**. Frontend *sophistication* isn't graded —
  working, dynamic integration is.

**Deliverables (submit two assets on the campus platform)**
1. **GitHub repository link** — clean, documented code for **both** the backend/model and the
   frontend app, plus a brief `README.md` on how to run it.
2. **Final presentation deck** — slides, PDF format preferred.

**Presentation day rules**
- **Exactly 15 minutes** per group — pitch + live MVP demo + brief Q&A. Strictly enforced.
- **Every member must actively speak.**
- A **live MVP demo** is expected; static screenshots count against you.

### Grading rubric (weights)

| Pillar | Weight | What's assessed |
|---|---|---|
| Technical Depth & Model Architecture | **25%** | Framework justification (RAG vs fine-tuning, single- vs multi-agent, tool use), data prep / feature engineering, eval metrics (LLM-as-a-judge, RAGAS, correctness, latency), guardrails for hallucination / security / agent loops |
| MVP Integration & Frontend UX | **25%** | Seamless, real-time frontend↔backend integration; intuitive, professional interface |
| Business Use Case & Value Proposition | **20%** | Compelling, realistic problem; quantified value (ROI, cost, efficiency); MVP usability |
| Presentation & Team Delivery | **20%** | Executive-level pitch; smooth speaker transitions; all members speak |
| Live Demo & Time Management | **10%** | Working live demo; finishing within the 15-minute limit |

### How this project meets them

| Requirement | Status | Where it stands |
|---|---|---|
| GenAI / agentic backend | Done | LangGraph multi-agent graph in `src/` |
| Real, compelling business problem | Done | Support-ticket triage + drafting with a human approval gate (see below) |
| Framework justification | Done | Multi-agent rationale in `docs/architecture.md` §1, §8 |
| Tool use | Done | `lookup_order`, `search_kb`, `check_refund_policy` (`src/tools.py`) |
| Routing | Done | Conditional edges from `router` → specialist (`src/graph.py`) |
| State / memory | Done | Typed `SupportState` + `MemorySaver` checkpointer per thread |
| Bounded refinement loop | Done | `critic` → `revise` → `critic`, bounded by `MAX_REVISIONS` |
| Human-in-the-loop / guardrails | Done | `interrupt_before=["human_approval"]` pauses before sending |
| Tests / reliability | Done | **12 passing tests**; runs offline in `mock` mode |
| **Frontend for non-technical users** | **TODO** | Not built yet — now **required** (25%). Plan: a Streamlit UI wrapping `src/main.py` |
| **Real-time frontend↔backend integration** | **TODO** | Depends on the frontend above; must show live results, not screenshots |
| **Quantified value proposition** | Partial | Qualitative today; add ROI / time-saved / cost numbers for the pitch |
| **Eval metrics (LLM-as-judge, latency)** | Partial | Add a small evaluation harness to demonstrate correctness/latency |
| **Presentation deck (PDF)** | **TODO** | Separate graded deliverable |
| **15-min, all-speak, live demo** | Plan | Assign speaking parts; rehearse to the strict 15-minute limit |

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