# AGENT.md — Operating Guide for Contributors

This file is the contract every contributor (and any AI assistant helping them) follows when
working on this repository. Read it **before** making any change, so anyone can pick up the
project, understand what happened, and know what to do next without re-discovering context.

> **Project:** **PageForge** — a strategy-first, two-agent landing-page generator
> (IE University, *Generative AI* final project). See **[`README.md`](README.md)** for the
> product overview and team, and **[`docs/CODE_GUIDE.md`](docs/CODE_GUIDE.md)** for a detailed,
> file-by-file walkthrough of the code.
>
> The **active product is the Next.js app in `web/`.** Its design system, UI guidelines, and
> architecture rules live in **[`web/AGENT.md`](web/AGENT.md)** — read that before touching
> anything under `web/`. An earlier Python/Streamlit prototype is kept in `src/` for reference.

---

## 1. Core rules (non-negotiable)

1. **Humans are the contributors, not the AI.** Never list an AI as a commit author,
   co-author, or PR author. Every commit and PR is authored under the **human contributor's
   own name and email**.
2. **Clarify before building.** If a task is vague, ask questions first (scope, inputs,
   expected output, edge cases, who it's for). Don't guess on ambiguous, high-impact decisions.
3. **Keep the docs in sync.** When behaviour changes, update `README.md`, this file, and
   (for frontend changes) `web/AGENT.md` so they reflect reality.
4. **Organize everything into folders.** Code for the app lives in `web/`, the legacy
   prototype in `src/`, docs in `docs/`. No stray files in the repo root beyond the standard
   ones (`README.md`, `AGENT.md`, `.gitignore`, etc.).

## 2. Workflow rules

- **Conventional Commits:** `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `chore:`.
  Example: `feat(web): add credentials settings panel`.
- One commit / PR = one logical change. Keep history readable.
- **Never force-push `main`.**

## 3. Repository structure

```
generative_AI_project/
├── README.md              # product overview + team + how to run
├── AGENT.md               # this file — operating rules + changelog
├── docs/
│   ├── CODE_GUIDE.md      # detailed annotated walkthrough of the whole codebase
│   └── architecture.excalidraw  # editable architecture flow diagram
├── web/                   # ★ the active product (Next.js + TypeScript)
│   ├── AGENT.md           # frontend design system + architecture rules
│   ├── README.md          # how to run / deploy the web app
│   ├── app/               # pages + API routes (App Router)
│   ├── components/        # React UI components
│   ├── lib/               # agents, the LLM provider seam, types, the graph
│   └── public/            # static assets (e.g. ie-logo.png)
└── src/, frontend/        # legacy Python/Streamlit prototype (reference only)
```

## 4. Secrets & environment (web app)

- **Never commit `.env*` or any key.** They are gitignored — keep it that way.
- Web-app config (`web/.env.local`, or Vercel env vars):
  - `LLM_PROVIDER` = `gemini` | `vertex`
  - `GEMINI_API_KEY` (Gemini API path)
  - `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_SERVICE_ACCOUNT_JSON` (Vertex path)
- Users can also supply their **own** credentials at runtime via the in-app **Settings** panel;
  those are stored only in the browser and sent per-request.
- If a secret is ever pasted into a chat or committed, treat it as **compromised**: rotate it.

## 5. Quality gate (web app)

- **`npm run build` must pass before merging** (`cd web && npm run build`). The Next.js build
  type-checks the whole app — a green build is the bar.
- Deployments are automatic on push to `main` via **Vercel** (root directory `web`).

## 6. Architecture rules (web app)

- **Two agents, justified:** `runStrategist` (decisions) → human approval → `runGenerator`
  (execution). Keep them separate so copy can never skip the strategy step. See `web/lib/agents.ts`.
- **Go through the provider seam** (`web/lib/llm.ts → callModel(...)`); never call a model SDK
  directly from a route or component. The app must stay swappable across `gemini | vertex`.
- **Keep secrets server-side.** Model calls happen only in `web/app/api/*` (Node runtime),
  never in the browser.
- **Stream progress** from the API routes to the UI via Server-Sent Events for real-time UX.

---

# ✅ CHANGELOG

> Newest at the top.

- **2026-06-27 · PageForge web app (the submitted product)**
  - Rebuilt the project as a **Next.js 14 + TypeScript app in `web/`**, deployed on **Vercel**.
  - **Two-agent flow with a human-approval gate** ("Plan Mode"): `/api/plan` runs the
    Strategist, the user approves an editable plan card, `/api/generate` runs the Generator.
  - **Provider seam** (`lib/llm.ts`) targeting **Gemini API** or **Vertex AI**, switchable by
    env var or per-request from the in-app **Settings** panel.
  - Real-time **SSE streaming** of agent progress; Google **Gemini 2.5 Flash** as the model.
  - UI: Gemini-style chat, Apple-inspired design tokens, light/dark theme, conversation
    history + rename, photo upload (min 3) with base64 embedding, model picker, voice input,
    a built-in **Architecture view** with hover explainers, IE-logo favicon, and a custom cursor.
  - Added **[`docs/CODE_GUIDE.md`](docs/CODE_GUIDE.md)** (annotated walkthrough) and refreshed
    `README.md` (product + team) and this file.
- **2026-06-25 · Legacy prototype**
  - Initial Python/LangGraph + Streamlit version of the Strategist → Generator idea (`src/`,
    `frontend/app.py`). Kept for reference.
