# PageForge — AI Marketing Strategy → Landing Page

> **Live demo:** https://generative-ai-project-puce.vercel.app/

Final project for the **Generative AI** course at **IE University** — a fully functional MVP
that solves a real business problem with an **agentic** GenAI architecture and a polished,
real-time frontend.

PageForge is a **strategy-first, two-agent landing-page generator** for small and medium
businesses. You describe your business in plain language; an AI **Strategist** makes the
marketing *decisions* a brand strategist would (positioning, audience, value proposition,
tone, conversion goal); you review and approve that plan; then an AI **Generator** turns the
approved plan — plus any photos you upload — into a complete, downloadable HTML landing page.

---

## Team

- **Ricardo Liévano Pedroza**
- **Cecile Tambey**
- **Luka Tcheishvili**
- **Juan José Rincón Briceño**
- **Nicklas Urban**
- **Michael Alexis Concepcion**

---

## The business problem

Small and medium businesses need a web presence but can't afford a strategist or an agency.
Generic AI site builders produce templated pages with **no marketing strategy** behind them —
no positioning, no audience targeting, no conversion goal. PageForge makes the **marketing
decisions first**, lets a human approve them, then renders them into a real landing page. The
value proposition: the **80% mechanical work** (strategy drafting + page building) is
automated, while a human keeps control of the **one decision that matters** (approving the
plan) in seconds.

## Why agents (not a single prompt)

Strategy and execution are different jobs. A single prompt asked to "write a landing page"
collapses both into one pass and quietly defaults to generic stock copy. Splitting them into
two agents forces the strategic decisions to happen **before — and independently of — the
copy/design execution**, with an explicit **human approval gate** in between. This is the
project's core architectural justification (multi-agent + tool use + human-in-the-loop).

## Architecture at a glance

```
You (browser)                        ← Next.js React UI (web/) — unchanged
   │  describe your business
   ▼
/api/plan   ──▶  STRATEGIST agent     ← Python backend (server/): turns the brief into a plan (JSON)
   │
   ▼
PLAN CARD   ──▶  you review & approve  ← the human-in-the-loop gate ("Plan Mode")
   │  confirm
   ▼
/api/generate ─▶ GENERATOR agent       ← Python backend: turns the approved plan + photos into HTML
   │
   ▼
Landing page (download / preview)
```

The React frontend (`web/`) calls same-origin `/api/plan` and `/api/generate`, which a Next.js
rewrite proxies to a separate **Python** backend (`server/`, FastAPI + LangGraph). Both agents
call Google **Gemini 2.5 Flash** through a single **provider seam** (`server/app/llm.py`) that
can target the **Gemini API** *or* **Vertex AI** — switched by one environment variable, or
overridden per-request from the in-app **Settings** panel. The two-agent flow is orchestrated
by **LangGraph** (`server/app/graph.py`).

There is a built-in **Architecture view** inside the app (the grid icon in the left rail) that
diagrams this exact flow, with hover popovers explaining each component.

## Tech stack

- **Frontend:** Next.js 14 (App Router) + TypeScript, deployed on **Vercel**
- **Backend:** **Python** — FastAPI serving SSE, in `server/`
- **Agents / orchestration:** **LangGraph** (Python), custom prompts
- **LLM:** Google **Gemini 2.5 Flash** via the Gemini API or Vertex AI (`google-generativeai` / `vertexai`)
- **Real-time:** Server-Sent Events (SSE) stream each agent's progress live to the UI
- **State:** typed `Plan` / `Strategy` objects (Pydantic in Python, TS types in the UI); conversation history + settings in `localStorage`

## How to run it

The app is two services: the **Python backend** (`server/`) and the **Next.js frontend**
(`web/`). Run both — two terminals:

```bash
# terminal 1 — Python backend (FastAPI + LangGraph)
cd server
python -m venv .venv
.venv\Scripts\Activate.ps1         # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# terminal 2 — Next.js frontend (proxies /api/* to the backend)
cd web
npm install
npm run dev                        # http://localhost:3000
```

**Config** lives in `web/.env.local` (the backend reads it automatically) —
**Gemini API (simplest):**

```
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_key_here       # free key: https://aistudio.google.com/apikey
```

**Or Vertex AI (Google Cloud):**

```
LLM_PROVIDER=vertex
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=europe-west1
GOOGLE_SERVICE_ACCOUNT_JSON=<service-account JSON, raw or base64>
```

Backend details: **[`server/README.md`](server/README.md)**. Full Vertex setup and
deployment: **[`web/README.md`](web/README.md)**.

Then: open the app, describe a business, **review/approve the plan**, upload at least 3
photos, hit **Confirm & build page**, and download the generated landing page.

## How it maps to the IE grading rubric

| Pillar | Where it's satisfied |
|---|---|
| **Technical depth & architecture** | Justified multi-agent design (Strategist → human approval → Generator); Python backend; provider seam; LangGraph graph; prompt engineering in `server/app/agents.py` |
| **MVP integration & frontend UX** | Real-time SSE streaming from the Python FastAPI backend (`server/app/main.py`) to the chat UI; polished Next.js interface deployed on Vercel |
| **Business use case & value** | Strategy-driven pages for SMBs that can't afford an agency; human-in-the-loop risk control |
| **Live demo & integration** | Working live demo at the URL above; frontend ↔ backend stream results in real time |

## Documentation

- **[`docs/CODE_GUIDE.md`](docs/CODE_GUIDE.md)** — a detailed, file-by-file walkthrough of the
  whole codebase with the code and plain-English explanations beside it (built for the Q&A).
- **[`server/README.md`](server/README.md)** — the Python backend (FastAPI + LangGraph): how to run it.
- **[`web/AGENT.md`](web/AGENT.md)** — the frontend's design system and architecture rules.
- **[`AGENT.md`](AGENT.md)** — repository operating guide (workflow, rules, changelog).
