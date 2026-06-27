# PageForge — AI Marketing Strategy → Landing Page (Web)

Next.js + TypeScript rewrite of the BrewPage pipeline, generalized from coffee
shops to **any small or medium business** and built to deploy on **Vercel**.

A non-technical owner fills in a short form (optionally uploads photos), and a
two-agent **LangGraph.js** pipeline:

1. **Strategist** — makes the marketing decisions (positioning, audience, value
   proposition, tone, conversion goal) and returns them as JSON.
2. **Generator** — turns that strategy + any photos into a single, self-contained,
   downloadable HTML landing page.

Progress streams to the browser live (Server-Sent Events) as each agent finishes.

The model provider is swappable via one env var — **Gemini API** or **Vertex AI** —
behind a single seam (`lib/llm.ts`). The graph never changes.

```
app/
  page.tsx              the form UI + live SSE consumption + result tabs
  api/generate/route.ts runs the graph, streams progress as SSE
lib/
  types.ts              Shop / Strategy types, business types & goals
  llm.ts                provider seam: gemini | vertex
  agents.ts             strategist + generator nodes (prompts, helpers)
  graph.ts              LangGraph.js StateGraph: strategist -> generator
```

---

## Run locally

Requires **Node.js 20+**.

```bash
cd web
npm install
# create a file named  web/.env.local  with the variables shown below
npm run dev                     # http://localhost:3000
```

### Provider config (.env.local)

**Option A — Gemini API (simplest):**

```
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_key_here    # free key: https://aistudio.google.com/apikey
```

**Option B — Vertex AI (Google Cloud):**

```
LLM_PROVIDER=vertex
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_SERVICE_ACCOUNT_JSON=<raw service-account JSON, or base64 of it>
```

Locally you can skip `GOOGLE_SERVICE_ACCOUNT_JSON` and instead authenticate with
Application Default Credentials:

```bash
gcloud auth application-default login
```

---

## Vertex AI / Google Cloud setup

1. **Create a project** — https://console.cloud.google.com/projectcreate
   Note the **Project ID** and **Project Number**.
2. **Enable billing** on that project (Vertex requires it; new accounts get free credit).
3. **Enable the Vertex AI API:**
   ```bash
   gcloud services enable aiplatform.googleapis.com --project YOUR_PROJECT_ID
   ```
   (or Console → APIs & Services → Enable APIs → "Vertex AI API").
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
5. **Give the JSON to the app.** For Vercel, base64-encode it so it fits cleanly
   in one env var:
   ```bash
   base64 -w0 key.json        # Linux
   # macOS: base64 -i key.json
   ```
   Paste the result into `GOOGLE_SERVICE_ACCOUNT_JSON`. **Do not commit `key.json`.**

---

## Deploy to Vercel

1. Push this repo to GitHub (already connected).
2. On vercel.com → **New Project** → import the repo.
3. Set **Root Directory** to `web`.
4. Add the environment variables (same as `.env.local`) under
   **Settings → Environment Variables**.
5. Deploy. Vercel auto-detects Next.js and builds it.

> Generation takes ~20–40s. `maxDuration` is set to 60s in the API route; if you
> hit timeouts on the Hobby plan, shorten the prompt or upgrade to Pro (300s).
