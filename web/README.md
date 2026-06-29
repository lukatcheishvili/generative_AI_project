# PageForge — Web frontend (Next.js + TypeScript)

The **React frontend** for PageForge, generalized from coffee shops to **any
small or medium business** and built to deploy on **Vercel**.

> The **backend brains** (the two agents, the LangGraph pipeline, and the LLM
> provider seam) now live in a separate **Python** service in
> [`../server`](../server) (FastAPI + LangGraph). This `web/` app is the UI only.

A non-technical owner describes their business (optionally uploads photos), and a
two-agent pipeline running in the Python backend:

1. **Strategist** — makes the marketing decisions (positioning, audience, value
   proposition, tone, conversion goal) and returns them as JSON for the human to
   approve.
2. **Generator** — turns the approved strategy + any photos into a single,
   self-contained, downloadable HTML landing page.

Progress streams to the browser live (Server-Sent Events) as each agent runs.

The frontend calls same-origin `/api/plan` and `/api/generate`; `next.config.mjs`
**rewrites** those to the Python backend (default `http://127.0.0.1:8000`,
override with `PY_BACKEND_URL`). The provider (Gemini API vs Vertex AI) is chosen
in the backend — see [`../server/README.md`](../server/README.md).

```
app/
  page.tsx        the whole UI: brief → plan approval → result, live SSE consumption
  layout.tsx      app shell (theme, favicon, custom cursor)
  globals.css     design tokens + all styling
components/       ThemeToggle, CustomCursor, ArchitectureDiagram
lib/
  types.ts        Shop / Strategy / Plan types, goals, model list (used by the UI)
  framers.ts      the design-system catalog the Plan card / picker renders
```

(The former `lib/llm.ts`, `lib/agents.ts`, `lib/graph.ts` and `app/api/*` route
handlers were ported to Python and now live in `../server`.)

---

## Run locally

Requires **Node.js 20+** for the frontend and **Python 3.11+** for the backend.
You need **both** running for local dev.

```bash
# terminal 1 — Python backend (see ../server/README.md)
cd server
python -m venv .venv
.venv\Scripts\Activate.ps1            # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# terminal 2 — Next.js frontend
cd web
npm install
npm run dev                            # http://localhost:3000
```

Open http://localhost:3000, describe a business, **approve the plan**, upload at
least 3 photos, and build the page.

### Where config lives

The frontend itself needs **no** env vars for normal use. All model/provider
config (`LLM_PROVIDER`, `GEMINI_API_KEY`, `GOOGLE_CLOUD_PROJECT`, …) is read by
the **Python backend** — it loads them from `web/.env.local` automatically (the
shared source of truth) or from `server/.env`. Users can also enter their own
credentials at runtime via the in-app **Settings** panel, which are sent
per-request to the backend.

---

## Vertex AI / Google Cloud setup (for the backend)

These steps configure the **Python backend's** provider. Set the resulting
values in `web/.env.local` (shared) or `server/.env`.

1. **Create a project** — https://console.cloud.google.com/projectcreate
   Note the **Project ID** and **Project Number**.
2. **Enable billing** on that project (Vertex requires it; new accounts get free credit).
3. **Enable the Vertex AI API:**
   ```bash
   gcloud services enable aiplatform.googleapis.com --project YOUR_PROJECT_ID
   ```
4. **Create a service account** with the **Vertex AI User** role
   (`roles/aiplatform.user`), then create a **JSON key** for it:
   ```bash
   gcloud iam service-accounts create pageforge \
     --display-name "PageForge Vertex" --project YOUR_PROJECT_ID

   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member "serviceAccount:pageforge@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role roles/aiplatform.user

   gcloud iam service-accounts keys create key.json \
     --iam-account pageforge@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```
5. **Give the JSON to the backend** as `GOOGLE_SERVICE_ACCOUNT_JSON` (raw or
   base64). Locally you can skip it and use Application Default Credentials:
   ```bash
   gcloud auth application-default login
   ```

---

## Deploy

The frontend deploys to **Vercel** (Root Directory = `web`) as before, but the
Python backend must be hosted separately (e.g. Render, Railway, or Google Cloud
Run). After deploying the backend, set `PY_BACKEND_URL` in the Vercel project's
environment variables to the backend's public URL so the rewrite proxies to it.

> Production deployment of the Python service is an open task — see the root
> `AGENT.md` §6. For grading/demo, the app runs end-to-end locally with the two
> commands above.
