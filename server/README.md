# PageForge — Python backend (FastAPI + LangGraph)

This is the **backend brains** of PageForge, ported 1:1 from the original
TypeScript (`web/lib/*.ts` + the two Next.js API routes) to **Python**. It runs
the two-agent pipeline (Strategist → human approval → Generator) on **LangGraph**
and serves the same two **Server-Sent-Events** endpoints the React UI already
calls. The frontend in `web/` is unchanged — it reaches this service through a
Next.js rewrite (`/api/* → http://127.0.0.1:8000/api/*`).

```
server/
├── app/
│   ├── llm.py        provider seam: call_model() → gemini | vertex
│   ├── types.py      shared shapes (Shop, Strategy, Plan, Credentials)
│   ├── framers.py    the 5-framer design-system catalog
│   ├── agents.py     the two agents + their prompts (the brains)
│   ├── graph.py      the pipeline as LangGraph StateGraphs
│   └── main.py       FastAPI app: POST /api/plan, POST /api/generate (SSE)
└── requirements.txt
```

## Run it

From the repo root:

```bash
cd server
python -m venv .venv
# Windows (PowerShell):  .venv\Scripts\Activate.ps1
# macOS / Linux:         source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The server starts on `http://127.0.0.1:8000`. It automatically reads
`web/.env.local` for config (`LLM_PROVIDER`, `GEMINI_MODEL`,
`GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_SERVICE_ACCOUNT_JSON`,
`GEMINI_API_KEY`), so you don't have to duplicate secrets. To override anything
just for the backend, copy `.env.example` to `server/.env`.

## Run the full app (frontend + backend) for local dev

Two terminals:

```bash
# terminal 1 — backend
cd server && uvicorn app.main:app --reload --port 8000

# terminal 2 — frontend (proxies /api/* to the backend)
cd web && npm install && npm run dev      # http://localhost:3000
```

Then open http://localhost:3000, describe a business, approve the plan, and
build the page exactly as before. If the backend runs elsewhere, point the
frontend at it with `PY_BACKEND_URL` (see `web/next.config.mjs`).

## Smoke-test the endpoints directly

```bash
curl -N -X POST http://127.0.0.1:8000/api/plan \
  -H "Content-Type: application/json" \
  -d '{"brief":"a cozy specialty coffee shop in Madrid that wants more walk-ins"}'
```

You should see `event: progress` then `event: done` with the plan JSON.

## LangGraph

`app/graph.py` builds three compiled `StateGraph`s that share the same nodes:
`STRATEGIST_GRAPH`, `GENERATOR_GRAPH`, and the canonical end-to-end
`PIPELINE_GRAPH` (Strategist → Generator). The two endpoints invoke the first
two, so **every model call is orchestrated by LangGraph**, while the human
approval gate stays between the two HTTP calls — the original "interrupt before
you act" design.

## Deploy to production

The Vercel frontend proxies `/api/*` to this backend, so it must be hosted
somewhere that runs Python. Config for the common hosts is included.

### Render (recommended — native Python, free tier)

1. Push this repo to GitHub.
2. Render dashboard → **New → Blueprint** → connect the repo. Render reads
   [`render.yaml`](render.yaml) and creates the `pageforge-backend` web service
   (root dir `server`, Python pinned by [`.python-version`](.python-version)).
3. When prompted, set the **secret** env vars (the non-secret ones are already in
   `render.yaml`):
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — the base64 string from `web/.env.local`
   - `GEMINI_API_KEY` — only if you use the Gemini provider instead of Vertex
4. Deploy. Confirm `https://<your-service>.onrender.com/health` returns
   `{"status":"ok"}`.

> **Free-tier cold start:** the instance spins down after ~15 min idle; the first
> request then takes ~50s to wake. Before a live demo, hit `/health` once to warm
> it up, or use a paid instance.

### Railway / Cloud Run / Fly (Docker)

Use the included [`Dockerfile`](Dockerfile) (build context = `server/`):

```bash
# Railway: New Project → Deploy from repo → set the service root to /server
# Cloud Run:
gcloud run deploy pageforge-backend --source server --region europe-west1 \
  --set-env-vars LLM_PROVIDER=vertex,GEMINI_MODEL=gemini-2.5-flash,\
GOOGLE_CLOUD_PROJECT=generative-ai-class-496013,GOOGLE_CLOUD_LOCATION=europe-west1
# then set GOOGLE_SERVICE_ACCOUNT_JSON as a secret env var in the host's dashboard.
```

### Point the Vercel frontend at the backend

In the Vercel project (the `web/` app) → **Settings → Environment Variables**, add:

```
PY_BACKEND_URL = https://<your-backend-host>
```

Then **redeploy** the frontend (the rewrite in `web/next.config.mjs` reads this at
build time). After that, the live site's `/api/plan` and `/api/generate` proxy to
this backend and the app works end-to-end in production.

