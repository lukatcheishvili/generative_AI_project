# AGENT.md — Project Context, Rules & Log

**Single source of truth for this branch (`stremlit-langraph`).** Read this first. It gives any
contributor — or an LLM they connect the repo to — the full context: what the project is, how
it's built, the rules to follow, where things stand, and a **log of what's been done** (at the
bottom) so you know where to continue.

---

## 1. Project at a glance

- **Name:** PageForge — a strategy-first, two-agent landing-page generator.
- **Course:** Generative AI — final project, **IE University** (functional MVP).
- **Team:** Ricardo Liévano Pedroza · Cecile Tambey · Luka Tcheishvili · Juan José Rincón Briceño · Nicklas Urban · Michael Alexis Concepcion.
- **Repo:** https://github.com/lukatcheishvili/generative_AI_project
- **Run locally:** `cd python && streamlit run app.py` → http://localhost:8501 (no hosted demo).
- **Status:** This branch is the **Streamlit + LangGraph (Python)** implementation of PageForge,
  in **`python/`**. It works end-to-end locally, with **LangGraph driving the human-in-the-loop
  approval gate**. (The Next.js/TypeScript `web/` app lives on other branches — `main`,
  `PageForge_V2` — not here.)

## 2. The product

Small/medium businesses can't afford a strategist or agency, and generic AI site builders make
templated pages with no marketing strategy. PageForge makes the **marketing decisions first**,
lets a **human approve** them, then builds the page:

```
describe business → STRATEGIST agent → editable PLAN (human approves) → GENERATOR agent → HTML page
```

- **Why two agents (not one prompt):** strategy and execution are different jobs. Splitting them
  forces the decisions to happen first and independently, with a human-in-the-loop gate between.
- **The gate is real LangGraph:** the pipeline is compiled with a checkpointer and
  `interrupt_before=["generator"]`, so after the Strategist writes the plan the graph **pauses**,
  Streamlit shows the editable plan, and the Generator only runs once the human confirms.

## 3. Architecture & key files

**Stack:** **Streamlit** (UI) · **LangGraph** (orchestration, Python) · Google **Gemini 2.5
Flash** via the Gemini API **or** Vertex AI. Everything lives in `python/`.

```
python/
├── app.py                  Streamlit UI (brief → approve → page); Settings panel
├── requirements.txt
├── .streamlit/config.toml
└── src/
    ├── state.py            PipelineState (brief, model, creds, images, plan, html)
    ├── llm.py              PROVIDER SEAM: call_model() → gemini | vertex
    ├── framers.py          design-system catalog (5 looks the Generator builds in)
    ├── agents.py           the two agents + their prompts (the brains): strategist/generator
    ├── graph.py            LangGraph: strategist → [interrupt_before] → generator
    └── main.py             CLI runner (straight-through graph, no pause)
```

`graph.py → agents.py → llm.py`: the graph orders the agents, the agents call the model. A full,
friendly walkthrough is in **[`python/README.md`](python/README.md)**.

## 4. Quick reference (facts you'll need)

| Thing | Value |
|---|---|
| **Run locally** | `cd python && python -m venv .venv && pip install -r requirements.txt && streamlit run app.py` — create `python/.env` first (vars below) |
| **Sanity check** | `cd python && python -c "import app; import src.graph"` (imports cleanly) |
| **CLI (one-shot)** | `cd python && python -m src.main --brief "…" --out page.html` |
| **GCP project (Vertex option)** | ID `generative-ai-class-496013` · region `europe-west1` |
| **Model** | `gemini-2.5-flash` — Strategist temperature **0.6** (focused), Generator **0.8** (creative) |

**Environment variables** (`python/.env`):

```
LLM_PROVIDER=gemini                 # gemini | vertex
GEMINI_MODEL=gemini-2.5-flash
# Gemini API path (simplest):
GEMINI_API_KEY=...                  # free key: aistudio.google.com/apikey
# Vertex AI path:
GOOGLE_CLOUD_PROJECT=generative-ai-class-496013
GOOGLE_CLOUD_LOCATION=europe-west1
GOOGLE_SERVICE_ACCOUNT_JSON=...     # service-account JSON, raw OR base64 (or use ADC)
```

Users can also enter their **own** provider/keys at runtime via the in-app **Settings** panel
(sent per-session, not persisted). Full run steps: `python/README.md`.

## 5. Rules (non-negotiable)

1. **Humans author commits.** Never list an AI as a commit/PR author or co-author.
2. **Clarify before building** on ambiguous, high-impact decisions.
3. **Conventional Commits:** `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `chore:`.
4. **Secrets never go in git.** `.env*` is gitignored. Document any new config in the env-var
   table above (§4) and in `python/README.md`. If a secret is ever exposed, **rotate it**.
5. **All model calls go through the provider seam** (`python/src/llm.py → call_model`). Keys stay
   on the machine running the app; never hard-code them.
6. **The app must run** before marking work done — `cd python && streamlit run app.py` should
   start, and `python -c "import app; import src.graph"` should import without error.
7. **Keep docs in sync** — update `README.md`, this file, `python/README.md`, and the log below.
8. **Read this file first, every session.** Before doing any work, analyze `AGENT.md` — the
   rules, the current status (§1), the **Open actions** (§6), and the **PROJECT LOG** at the
   bottom — so you know **what has been done and what still needs doing**, then continue from
   there. When you finish a piece of work, add it to the PROJECT LOG.
9. **Greet the contributor by name.** Begin every reply by addressing the person you're working
   with by their name (e.g. "Hey Luka, …") before you start generating or making changes.

## 6. Open actions / where to continue

- [ ] **Rehearse the live demo** — all members speak; finish within the time limit. Run the app
      live (`streamlit run app.py`): describe a business → approve the plan → build the page.
- [ ] **SECURITY — rotate exposed secrets.** During earlier setup a **GitHub personal access
      token** and a **Vertex service-account key** were pasted into chat → treat both as
      compromised. Revoke/rotate: GitHub → Settings → Developer settings → Tokens; Google Cloud →
      IAM → Service Accounts → Keys (delete + create new).
- [ ] *(Optional, score-boosting)* a small **eval/metrics** table (latency, a quick quality
      check) and more model options in the picker.

## 7. Useful artifacts & tooling

- **Presentation deck:** `AI_agents_business_presentation.html` — a self-contained, slideable
  deck (covers the problem, product, the two-agent + LangGraph architecture, and the team).
- **App docs:** `python/README.md` (run + architecture).

---

# PROJECT LOG (newest first)

A running record of what's been done on this branch, so anyone (or an LLM) can see the history
and continue.

### Branch cleanup & docs (2026-06-29)
- Made `stremlit-langraph` the **Python-only** branch: removed the Next.js `web/` app and the
  `docs/` folder (both belong to the TypeScript implementation on `main` / `PageForge_V2`).
- Updated the **presentation deck** (`AI_agents_business_presentation.html`) to the latest version.
- Rewrote **`README.md`** and this **`AGENT.md`** to describe the Streamlit + LangGraph app and
  drop all stale Next.js/Vercel/TypeScript content and the dead hosted-demo link.

### Streamlit + LangGraph app
- Built the **`python/`** app: a **Streamlit** UI (`app.py`) over a **LangGraph** pipeline
  (`graph.py`) — `strategist → interrupt_before → generator`, compiled with a `MemorySaver`
  checkpointer so the human-approval pause persists state between the two agents.
- **Two agents** (`agents.py`): the Strategist (temp 0.6) extracts the business + makes the
  marketing decisions and picks a design "framer"; the Generator (temp 0.8) builds a single-file
  HTML landing page from the approved plan + any photos.
- **Provider seam** (`llm.py`): one `call_model()` targets the Gemini API **or** Vertex AI,
  switchable by `LLM_PROVIDER` or the in-app Settings panel.
- **Framer catalog** (`framers.py`): 5 distinct design systems; the Strategist picks one, with a
  random fallback, editable before building.
- **CLI runner** (`main.py`): a straight-through graph (no pause) for a one-shot
  `--brief … --out page.html` run.

### Project start
- Strategy-first, two-agent concept for SMB landing pages: make the marketing decisions first,
  keep a human approval gate, then execute — the project's core architectural justification.
