# PageForge — AI Marketing Strategy → Landing Page

> **Strategy-first, two-agent landing-page generator — built on Streamlit + LangGraph (Python).**
> Runs locally: `cd python && streamlit run app.py`

Final project for the **Generative AI** course at **IE University** — a functional MVP that
solves a real business problem with an **agentic** GenAI architecture and a human-in-the-loop
approval gate.

PageForge is a **strategy-first, two-agent landing-page generator** for small and medium
businesses. You describe your business in plain language; an AI **Strategist** makes the
marketing *decisions* a brand strategist would (positioning, audience, value proposition,
tone, conversion goal); you review and approve that plan; then an AI **Generator** turns the
approved plan — plus any photos you upload — into a complete, downloadable HTML landing page.

The app lives in **[`python/`](python)** — see **[`python/README.md`](python/README.md)** for
full details.

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
brief ─▶ STRATEGIST ─▶ [human approval pause] ─▶ GENERATOR ─▶ landing page
            (agent)        (LangGraph interrupt)     (agent)
```

The approval gate is a real **LangGraph `interrupt_before`** pause: after the Strategist
writes the plan, the graph stops, Streamlit shows the editable plan, and the Generator only
runs once you confirm — so LangGraph is on the runtime hot path, not just a diagram.

Both agents call Google **Gemini 2.5 Flash** through a single **provider seam**
(`python/src/llm.py`) that can target the **Gemini API** *or* **Vertex AI** — switched by one
environment variable, or overridden per-session in the in-app **Settings** panel.

```
python/
├── app.py              Streamlit UI (brief → approve → page)
├── requirements.txt
├── .streamlit/config.toml
└── src/
    ├── state.py        PipelineState (brief, model, creds, images, plan, html)
    ├── llm.py          provider seam — Gemini OR Vertex (one call_model())
    ├── framers.py      design-system catalog (5 looks)
    ├── agents.py       strategist_node + generator_node (the prompts)
    ├── graph.py        LangGraph: strategist → [interrupt] → generator
    └── main.py         CLI runner (straight-through, no pause)
```

## Tech stack

- **UI + app:** **Streamlit** (Python)
- **Agents / orchestration:** **LangGraph** (Python) — a real `interrupt_before` human-in-the-loop gate
- **LLM:** Google **Gemini 2.5 Flash** via the Gemini API or Vertex AI (`google-generativeai` / `vertexai`)
- **State:** a typed `PipelineState` (brief, model, creds, images, plan, html)
- **Design systems:** 5 selectable "framer" looks the Generator builds in

## How to run it

The app lives in the **`python/`** folder.

```bash
cd python
python -m venv .venv
# Windows:        .venv\Scripts\activate
# macOS / Linux:  source .venv/bin/activate
pip install -r requirements.txt

# Gemini (simplest) — free key: https://aistudio.google.com/apikey
printf 'LLM_PROVIDER=gemini\nGEMINI_API_KEY=your_key_here\n' > .env

streamlit run app.py        # http://localhost:8501
```

**Or Vertex AI (Google Cloud)** — put this in `python/.env` instead:

```
LLM_PROVIDER=vertex
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_SERVICE_ACCOUNT_JSON=<service-account JSON, raw or base64>   # or use ADC
```

You can also override the provider, model, and keys per-session in the in-app **Settings**
panel. Then: describe a business, **review/approve the plan**, optionally upload photos, click
**Confirm & build page**, and download the generated HTML.

### CLI (non-interactive)

```bash
cd python
python -m src.main --brief "A cozy single-origin coffee shop in Lavapiés, Madrid" --out page.html
```

## How it maps to the IE grading rubric

| Pillar | Where it's satisfied |
|---|---|
| **Technical depth & architecture** | Justified multi-agent design (Strategist → human approval → Generator); a real **LangGraph `interrupt_before`** gate; provider seam (`python/src/llm.py`); prompt engineering in `python/src/agents.py` |
| **MVP integration & UX** | A working **Streamlit** app (`python/app.py`): describe → approve → build, photo upload, in-app Settings; downloadable HTML output |
| **Business use case & value** | Strategy-driven pages for SMBs that can't afford an agency; human-in-the-loop risk control |
| **Live demo** | Runs locally with `streamlit run app.py`; a CLI path (`python -m src.main`) gives a one-shot, straight-through run |

## Documentation

- **[`python/README.md`](python/README.md)** — full run + architecture walkthrough for the Streamlit + LangGraph app.
- **[`AGENT.md`](AGENT.md)** — repository operating guide (workflow, rules, changelog).
