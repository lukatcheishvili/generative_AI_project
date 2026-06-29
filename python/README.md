# PageForge — Python / Streamlit + LangGraph

A second implementation of PageForge (the [web/](../web) app is the Next.js/TypeScript one),
built on **Streamlit + LangGraph** with the same strategy-first, two-agent design.

```
brief ─▶ STRATEGIST ─▶ [human approval pause] ─▶ GENERATOR ─▶ landing page
            (agent)        (LangGraph interrupt)     (agent)
```

The approval gate is a real **LangGraph `interrupt_before`** pause: after the Strategist writes
the plan, the graph stops, Streamlit shows the editable plan, and the Generator only runs once
you confirm. LangGraph is therefore on the runtime hot path here.

## Layout

```
python/
├── app.py              # Streamlit UI (brief → approve → page)
├── requirements.txt
├── .streamlit/config.toml
└── src/
    ├── state.py        # PipelineState (brief, model, creds, images, plan, html)
    ├── llm.py          # provider seam — Gemini OR Vertex (one call_model())
    ├── framers.py      # design-system catalog (5 looks)
    ├── agents.py       # strategist_node + generator_node
    ├── graph.py        # LangGraph: strategist → [interrupt] → generator
    └── main.py         # CLI runner (straight-through, no pause)
```

`graph.py → agents.py → llm.py`: the graph orders the agents, the agents call the model.

## Run

```bash
cd python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Gemini (simplest) — free key: https://aistudio.google.com/apikey
printf 'LLM_PROVIDER=gemini\nGEMINI_API_KEY=your_key_here\n' > .env

streamlit run app.py        # http://localhost:8501
```

Then: describe a business, **review/approve the plan**, optionally upload photos, click
**Confirm & build page**, and download the generated HTML.

### Vertex AI instead of Gemini

```
LLM_PROVIDER=vertex
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_SERVICE_ACCOUNT_JSON=<service-account JSON, raw or base64>   # or use ADC
```

You can also override the provider, model, and keys per-session in the in-app **Settings** panel.

## CLI (non-interactive)

```bash
python -m src.main --brief "A cozy single-origin coffee shop in Lavapiés, Madrid" --out page.html
```
