# Support Triage Agent — Generative AI Final Project

A **multi-agent customer-support triage system** built with **LangGraph**. It takes a raw
customer ticket and runs it through a real agent workflow — classification, routing to a
specialist agent, tool calls against (mock) backends, a critic/refinement loop, and a
**human approval gate** before any reply is "sent."

The project is deliberately narrow so it actually works end to end, while still exercising
every architectural concept the course cares about: **routing, tool use, state/memory,
conditional logic, a refinement loop, and human-in-the-loop**.

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
        ├─ REVISE ──► revise ──► critic        (bounded refinement loop, max 2)
        └─ APPROVED ─► human_approval  ⟸ INTERRUPT (execution pauses here)
  → finalize          applies human edit (if any), "sends" the reply
  → END
```

| Concept the course asks about | Where it lives |
|---|---|
| Single- vs multi-agent | Multi-agent: a router + 4 specialists + a critic (`src/agents.py`) |
| How tools are called | Specialists call `lookup_order`, `search_kb`, `check_refund_policy` (`src/tools.py`) |
| How routing works | `add_conditional_edges("router", route_decision, …)` (`src/graph.py`) |
| State / memory | Typed `SupportState` + `MemorySaver` checkpointer per thread |
| Conditional logic / loops | `critic_decision` → revise-loop, bounded by `MAX_REVISIONS` |
| Human-in-the-loop | `interrupt_before=["human_approval"]` pauses before sending |

See [`docs/architecture.md`](docs/architecture.md) for the node-by-node justification you'll
present.

---

## Quick start

```bash
# 1. install
pip install -r requirements.txt

# 2. configure (mock mode needs no API key)
cp .env.example .env

# 3. run the demo — works with zero API keys in mock mode
python -m src.main "I think I was overcharged on order 1002 and want a refund"

# 4. run the test suite (also mock mode, no network)
pytest -q
```

### Using a real model

Edit `.env`:

```bash
LLM_PROVIDER=openai            # or: anthropic
OPENAI_API_KEY=sk-...          # or ANTHROPIC_API_KEY=sk-ant-...
```

The graph does not change — only the model behind the `LLMClient` seam (`src/config.py`)
does. That is the whole argument for the provider-agnostic design.

---

## Project layout

```
generative_AI_project/
├── src/
│   ├── config.py     # provider-agnostic LLM (openai | anthropic | mock)
│   ├── state.py      # typed graph state = the system's memory
│   ├── tools.py      # mock order DB, KB, refund-policy tools
│   ├── agents.py     # router, specialists, critic, revise, human gate, finalize
│   ├── graph.py      # LangGraph assembly: nodes, edges, interrupt, checkpointer
│   └── main.py       # CLI runner with the human-approval step
├── tests/test_system.py   # 12 tests: tools, routing, loop, human-in-the-loop
├── docs/architecture.md   # presentation-ready deep dive
├── requirements.txt
├── .env.example
└── .gitignore        # .env is ignored
```

## Mock mode

`LLM_PROVIDER=mock` swaps the real model for a deterministic rule-based stand-in. The graph,
tools, routing, loop, and interrupt all run unchanged — so the architecture is testable and
demoable offline, with no tokens spent. Flip one env var to go live.
