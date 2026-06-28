# AGENT.md — Project Context, Rules & Log

**Single source of truth for this repository.** Read this first. It gives any contributor — or
an LLM they connect the repo to — the full context: what the project is, how it's built, the
rules to follow, where things stand, and a detailed **log of everything done** (at the very
bottom) so you know exactly where to continue.

---

## 1. Project at a glance

- **Name:** PageForge — a strategy-first, two-agent landing-page generator.
- **Course:** Generative AI — final project, **IE University** (functional MVP + live demo).
- **Team:** Ricardo Liévano Pedroza · Cecile Tambey · Luka Tcheishvili · Juan José Rincón Briceño · Nicklas Urban · Michael Alexis Concepcion.
- **Live demo:** https://generative-ai-project-puce.vercel.app/
- **Repo:** https://github.com/lukatcheishvili/generative_AI_project
- **Status:** **Deployed and working end-to-end** on Vercel + Google Vertex AI. The active —
  and only — product is the Next.js app in **`web/`**. (The earlier Python/Streamlit prototype
  has been removed; the repo is now web-only. Its history remains in git.)

## 2. The product

Small/medium businesses can't afford a strategist or agency, and generic AI site builders make
templated pages with no marketing strategy. PageForge makes the **marketing decisions first**,
lets a **human approve** them, then builds the page:

```
describe business → STRATEGIST agent → editable PLAN CARD (human approves) → GENERATOR agent → HTML page
```

- **Why two agents (not one prompt):** strategy and execution are different jobs. Splitting them
  forces the decisions to happen first and independently, with a human-in-the-loop gate between.
- **Real-time:** progress streams from the server to the browser via Server-Sent Events (SSE).

## 3. Architecture & key files

**Stack:** Next.js 14 (App Router) + TypeScript · LangGraph.js · Google Gemini 2.5 Flash (via
Gemini API **or** Vertex AI) · deployed on Vercel.

```
web/
├── app/
│   ├── layout.tsx              app shell: theme, IE favicon, custom cursor
│   ├── page.tsx                the whole UI + client-side flow (the big file)
│   ├── globals.css             design tokens (light/dark) + all styling
│   └── api/
│       ├── plan/route.ts       runs the Strategist, streams progress (SSE)
│       └── generate/route.ts   runs the Generator, streams the HTML (SSE)
├── components/                 ThemeToggle, CustomCursor, ArchitectureDiagram
├── lib/
│   ├── types.ts                shared data shapes (Plan, Strategy, …)
│   ├── llm.ts                  PROVIDER SEAM: callModel() → gemini | vertex
│   ├── agents.ts               the two agents + their prompts (the brains)
│   └── graph.ts                the two-agent pipeline as a LangGraph graph
└── public/ie-logo.png          IE University logo (favicon)
```

A full, friendly, file-by-file walkthrough is in **[`docs/CODE_GUIDE.md`](docs/CODE_GUIDE.md)**.
The frontend design-system rules are in **[`web/AGENT.md`](web/AGENT.md)**.

## 4. Quick reference (facts you'll need)

| Thing | Value |
|---|---|
| **Run locally** | `cd web && npm install && npm run dev` — create `web/.env.local` first (vars below) |
| **Quality gate** | `cd web && npm run build` (type-checks the whole app — must pass) |
| **Deploy** | Auto on push to `main` via Vercel; **Vercel Root Directory = `web`** |
| **Production branch** | `main` |
| **GCP project** | ID `generative-ai-class-496013` · number `120451862856` · region `europe-west1` |
| **Vertex service account** | `generative-ai-vertex-user@generative-ai-class-496013.iam.gserviceaccount.com` (role: **Vertex AI User**) |
| **Model** | `gemini-2.5-flash` (Strategist temp 0.6, Generator 0.8) |

**Environment variables** (`web/.env.local` locally; Vercel → Settings → Environment Variables in prod):

```
LLM_PROVIDER=vertex                 # gemini | vertex
GEMINI_MODEL=gemini-2.5-flash
# Gemini API path:
GEMINI_API_KEY=...                  # free key: aistudio.google.com/apikey
# Vertex AI path:
GOOGLE_CLOUD_PROJECT=generative-ai-class-496013
GOOGLE_CLOUD_LOCATION=europe-west1
GOOGLE_SERVICE_ACCOUNT_JSON=...     # service-account JSON, raw OR base64 (base64 preferred for Vercel)
```

Users can also enter their **own** credentials at runtime via the in-app **Settings** panel
(stored only in the browser, sent per-request). Full Vertex/GCP setup steps: `web/README.md`.

## 5. Rules (non-negotiable)

1. **Humans author commits.** Never list an AI as a commit/PR author or co-author.
2. **Clarify before building** on ambiguous, high-impact decisions.
3. **Conventional Commits:** `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `chore:`.
4. **Secrets never go in git.** `.env*` is gitignored. Document any new config in the env-var
   table above (§4) and in `web/README.md`. If a secret is ever exposed, **rotate it**.
5. **All model calls go through the provider seam** (`web/lib/llm.ts → callModel`) and happen
   **only server-side** (the API routes). Keys never reach the browser.
6. **`npm run build` must pass** before merging. Don't mark work done on a red build.
7. **Keep docs in sync** — update `README.md`, this file, `web/AGENT.md`, and the log below.
8. **Read this file first, every session.** Before doing any work, analyze `AGENT.md` — the
   rules, the current status (§1), the **Open actions** (§6), and the **PROJECT LOG** at the
   bottom — so you know **what has been done and what still needs doing**, then continue from
   there. When you finish a piece of work, add it to the PROJECT LOG.
9. **Greet the contributor by name.** Begin every reply by addressing the person you're working
   with by their name (e.g. "Hey Luka, …") before you start generating or making changes.

## 6. Open actions / where to continue

- [ ] **Presentation deck (PDF)** — a graded deliverable; **not built yet**. Cover: business
      problem, value, the two-agent architecture, live demo, results. Use `README.md` +
      `docs/CODE_GUIDE.md` as source.
- [ ] **Rehearse the 15-minute live demo** — all 5 members must speak; finish within the limit.
- [ ] **SECURITY — rotate exposed secrets.** During setup, a **GitHub personal access token**
      and the **Vertex service-account key** were pasted into chat → treat both as compromised.
      Revoke/rotate them: GitHub → Settings → Developer settings → Tokens; Google Cloud → IAM →
      Service Accounts → `generative-ai-vertex-user` → Keys (delete + create new, update
      `GOOGLE_SERVICE_ACCOUNT_JSON` in Vercel).
- [ ] *(Optional, score-boosting)* a small **eval/metrics** table (latency, a quick quality
      check), a **custom domain**, and more model options in the picker.

## 7. Useful artifacts & tooling

- **Architecture:** an in-app **Architecture view** (grid icon in the left rail, hover boxes for
  explanations); a Figma board; and an editable **`docs/architecture.excalidraw`**.
- **Deploys:** every push to `main` triggers a Vercel build; build logs are in the Vercel
  dashboard (or via the Vercel MCP integration).

---

# PROJECT LOG (newest first)

A running record of everything done, so anyone (or an LLM) can see the history and continue.
All dates 2026-06-27 unless noted.

### Repo cleanup (2026-06-28)
- Removed the legacy **Python/Streamlit prototype** — `src/`, `frontend/`, `requirements.txt`
  and `.streamlit/` — which the live app never referenced; the repo is now **web-only**. Trimmed
  the now-dead Python/Streamlit entries from `.gitignore`. History retains the deleted files.

### Documentation pass
- Rewrote **`README.md`** for PageForge with the team list and IE-rubric mapping.
- Rewrote this **`AGENT.md`** into a full context + rules + log file.
- Added **`docs/CODE_GUIDE.md`** — a detailed, file-by-file annotated walkthrough for the Q&A.

### Architecture view & explainers
- Built an **in-app Architecture view** as a faithful SVG of the Figma board (dotted background,
  layered containers, dark boxes with colored borders, labeled elbow connectors).
- It renders **inline** (keeps the top bar, left rail, and sidebar visible); the rail
  **Architecture** button toggles it and sits **above** Settings.
- Added **hover popovers** on each box (dark card) explaining *why it's here / what it does /
  input / output* for non-technical viewers; fixed the `run` label overlapping a layer heading.
- Created a **Figma board** ("PageForge — Architecture") and an editable
  **`docs/architecture.excalidraw`**.

### Branding & polish
- Added the **IE University logo** (`web/public/ie-logo.png`) as the brand mark and the browser
  **favicon**; tab title set to "PageForge". Logo is separated from the name (only the name
  click → new chat), sized up, and shown white in dark mode.
- Added a **Figma-style custom cursor** (arrow), engineered to avoid double-pointer/lag bugs
  (native cursor hidden everywhere, direct transform updates, `pointer-events: none`).

### Features
- **Settings panel** with two tabs: **Credentials** (use your own Gemini key *or* Vertex
  project) and **About** (IE course disclaimer). Credentials are threaded per-request through
  `lib/llm.ts → agents → routes`.
- **Photo upload** dropzone in the plan card; **at least 3 photos required** before building.
- **Voice input** (Web Speech API) in the composer.
- **Conversation history** sidebar (saved in localStorage) with **rename/delete**; a left
  **rail** with sidebar-toggle + full-screen; **model picker** moved into the composer as a
  rounded custom dropdown; clicking the brand starts a new chat.

### Core app build & UI
- Built the **Next.js 14 + TypeScript app** in `web/`: a **two-agent LangGraph.js pipeline**
  (Strategist → Generator) behind a **provider seam** (`LLM_PROVIDER=gemini|vertex`), with
  **SSE streaming**. Generalized the concept from coffee shops to **any small/medium business**.
- Reworked the UI into a **Gemini-style chat** with explicit **Plan Mode** (describe → plan →
  approve → build), **Apple-inspired design tokens**, and **light/dark theme**.
- Split the backend into **`/api/plan`** (Strategist) and **`/api/generate`** (Generator).

### Infrastructure & deployment
- Created the **Vercel project** (Root Directory = `web`); set environment variables.
- Fixed deploy issues in order: pinned the framework to Next.js via **`web/vercel.json`** (fixed
  a "missing public dir" error); fixed a **TypeScript build error** (redundant `phase`
  comparison); re-pasted a truncated **`GOOGLE_SERVICE_ACCOUNT_JSON`** and **hardened the
  credential parser**; **granted the service account the Vertex AI User role** — which was the
  final blocker. Vertex now works **end-to-end** in `europe-west1`.
- Set up **Google Cloud**: project `generative-ai-class-496013`, enabled billing + the Vertex AI
  API, created the service account, stored its key as base64 in `web/.env.local`.

### Project start
- Decided (with the team) to **pivot** from the cloned Python/Streamlit "BrewPage" prototype to
  a **Next.js + Vercel** web app, generalized to any SMB.
- **Cloned `main` fresh** from GitHub and backed up the previous local folder; added the GitHub
  repo link + token to a gitignored `.env`.
