# PageForge — Code Guide

A **file-by-file reference** for the codebase. Each entry below is a header with
the file path and a detailed description of what that file does and why it
exists. Use it to prepare for the Q&A — by the end you should be able to point at
any file in the app and explain it.

> **⚠️ Backend moved to Python (2026-06-29).** The backend is now a **Python**
> service (FastAPI + LangGraph) in **`server/`**. The frontend (`web/`) is
> unchanged React/TypeScript and proxies `/api/*` to it. The backend sections
> below were originally written for the TypeScript files; the logic is **mirrored
> 1:1** in Python, so the explanations still hold — just read the new file path.
> File map:
>
> | Old (TypeScript) | New (Python) | Same logic? |
> |---|---|---|
> | `web/lib/llm.ts` | `server/app/llm.py` | Yes — provider seam `call_model()` |
> | `web/lib/types.ts` | `server/app/types.py` (+ `web/lib/types.ts` kept for the UI) | Yes — Pydantic models |
> | `web/lib/framers.ts` | `server/app/framers.py` (+ `web/lib/framers.ts` kept for the UI) | Yes — same catalog |
> | `web/lib/agents.ts` | `server/app/agents.py` | Yes — prompts verbatim |
> | `web/lib/graph.ts` | `server/app/graph.py` | Yes — LangGraph StateGraphs |
> | `web/app/api/plan/route.ts` | `server/app/main.py` `POST /api/plan` | Yes — same SSE contract |
> | `web/app/api/generate/route.ts` | `server/app/main.py` `POST /api/generate` | Yes — same SSE contract |
>
> What changed structurally: the React UI calls same-origin `/api/*`, and
> `web/next.config.mjs` **rewrites** those to the Python backend
> (`PY_BACKEND_URL`, default `http://127.0.0.1:8000`). `web/lib/types.ts` and
> `web/lib/framers.ts` remain in TypeScript because the UI imports them
> client-side. Run steps: **[`server/README.md`](../server/README.md)**.

---

## 0. The big picture in one minute

PageForge turns a sentence about a business into a finished landing page — in
**two AI stages with a human checkpoint in between**:

1. **You describe a business** in the chat box.
2. The **Strategist** agent turns it into a **marketing plan** (positioning,
   audience, tone, key messages) and **picks a design style ("framer")**.
3. **You review, edit, and approve** the plan. *This is the human-in-the-loop gate.*
4. The **Generator** agent turns the approved plan + your photos into a complete,
   self-contained **HTML landing page** you can preview and download.

Both agents run on **Google Gemini** through a single swappable seam (Gemini API
**or** Vertex AI). The app is **Next.js** (website *and* backend) on **Vercel**.

```
Browser (chat UI) ──POST /api/plan──▶  Strategist ──▶ Gemini ──▶ marketing plan + framer
        ▲                                                                  │
        │   you edit / approve the plan  ◀──────────────────────────────────┘
        │
        └──POST /api/generate──▶ Generator ──▶ Gemini ──▶ HTML landing page
```

---

## 1. Glossary (plain English)

| Term | What it means here |
|---|---|
| **Next.js** | A framework where one project is both the website (frontend) and a small backend (API routes). |
| **App Router** | The Next.js convention where files in `app/` become pages and API endpoints. |
| **Component** | A reusable piece of UI written in React (the theme toggle, the cursor, the diagram). |
| **State** | Data the UI remembers and reacts to (e.g. "are we planning or building right now?"). |
| **API route** | A backend function that runs on the server, not the browser (used to call the AI safely). |
| **LLM** | Large Language Model — the AI (Google Gemini) that generates text. |
| **Prompt** | The instructions sent to the LLM telling it exactly what to produce. |
| **Agent** | An LLM given a specific job + prompt (we have two: Strategist and Generator). |
| **Provider seam** | One function (`callModel`) that hides *which* AI provider is used, so we can swap them. |
| **Framer** | A named design system (colors, fonts, sizes, patterns) the generated page is built in. |
| **SSE (Server-Sent Events)** | A way for the server to stream live updates to the browser (the "…is working" progress). |
| **base64** | Encoding that turns an image file into a text string so it can be embedded inside the HTML. |
| **localStorage** | A small in-browser store that remembers things between visits (history, settings, theme). |

---

## 2. Project map

```
web/
├── app/
│   ├── layout.tsx              App shell: tab title/favicon, no-flash theme, app-wide cursor.
│   ├── page.tsx                The entire UI + client-side flow (the big file, ~1,425 lines).
│   ├── globals.css             All styling: design tokens (light/dark) + every component's CSS.
│   └── api/
│       ├── plan/route.ts       Backend endpoint — runs the Strategist, streams progress (SSE).
│       └── generate/route.ts   Backend endpoint — runs the Generator, streams the HTML (SSE).
├── components/
│   ├── ThemeToggle.tsx         Light/dark switch.
│   ├── CustomCursor.tsx        Figma-style cursor.
│   └── ArchitectureDiagram.tsx In-app architecture SVG with hover explainers.
├── lib/
│   ├── types.ts                Shared data shapes (Shop, Strategy, Plan) + models/goals/labels.
│   ├── llm.ts                  Provider seam: one place that talks to Gemini / Vertex.
│   ├── agents.ts               The two agents and their prompts (the brains).
│   ├── framers.ts              The design-system catalog + selection logic for generated pages.
│   └── graph.ts                The two-agent pipeline expressed as a LangGraph graph (documentary).
├── public/ie-logo.png          IE University logo (favicon + brand mark).
├── package.json · tsconfig.json · next.config.mjs · vercel.json · next-env.d.ts · .gitignore
├── .env.local                  Local secrets/config (gitignored).
└── README.md · AGENT.md        Web setup guide · frontend single-source-of-truth.
```

---

## 3. The data flow, step by step

1. You type a brief and press send. `app/page.tsx` calls **`POST /api/plan`** with your text.
2. `app/api/plan/route.ts` runs **`runStrategist()`** (`lib/agents.ts`).
3. `runStrategist` builds a prompt (extract basics → make marketing decisions → **choose a
   framer** from `lib/framers.ts`) and calls **`callModel()`** (`lib/llm.ts`), which sends it to
   **Gemini** and returns a marketing plan as JSON.
4. The plan streams back; `page.tsx` shows it as an **editable plan card** (incl. the framer dropdown).
5. You approve. `page.tsx` calls **`POST /api/generate`** with the (edited) plan + your photos.
6. `app/api/generate/route.ts` runs **`runGenerator()`**, which injects the chosen framer's design
   spec and prompts Gemini to write a full HTML page.
7. The HTML streams back; `page.tsx` shows a preview and a **Download** button.

Everything that touches an **API key happens on the server** (`app/api/*`), never in the browser.

---

## 4. File-by-file reference

### `web/app/layout.tsx`
The root layout that wraps every page (Next.js App Router). It does three things:
(1) sets page **metadata** — the browser tab title `PageForge` and the IE logo as the favicon;
(2) injects a tiny inline **no-flash theme script** that runs *before first paint*, reading the
saved theme from `localStorage` (or the OS `prefers-color-scheme`) and setting
`document.documentElement.dataset.theme` so the page never flashes the wrong theme on load;
(3) imports `globals.css` and mounts the app-wide `<CustomCursor />`. The page content is rendered
as `{children}`.

### `web/app/page.tsx`
The heart of the frontend — the **entire UI and the client-side flow** in one large client
component (`"use client"`). What's inside:
- **Constants & types:** `localStorage` keys, the **6 home-page suggestion chips** (`SUGGESTIONS`),
  the `Settings` shape/defaults, and `credentialsFromSettings` (maps the Settings panel to the
  per-request credentials).
- **Phase state machine:** `type Phase = "idle" | "planning" | "plan" | "building" | "done"`. The
  UI renders differently for each phase (greeting → progress → plan card → progress → result).
- **React state:** the selected `model`, the `brief` text, uploaded `files`/`previews` (photos),
  the current `plan`, the generated `html`, the `conversations` history (persisted to
  `localStorage`), the `settings`, and UI flags (sidebar open, theme, model menu, architecture view).
- **`streamSSE` helper:** opens a `fetch` to an API route and reads the **Server-Sent Events**
  stream frame-by-frame, calling back per event. It **aborts on a hard timeout** and **throws if
  the stream closes without a terminal `done`/`error` event** — so a killed/slow function surfaces
  an error instead of leaving the UI stuck on "Working…".
- **The flow:** `submitBrief` → `POST /api/plan` (reacts to `progress`/`done`/`error`);
  `confirmBuild` → converts photos to base64 and `POST /api/generate`; `editBrief` returns to the
  composer. Plan edits go through `updateBusiness` / `updateStrategy` / `updateFramer`.
- **UX details:** a `useLayoutEffect` **auto-grows the composer textarea** to fit its content; the
  **"Confirm & build" button is disabled until ≥ 3 photos** are attached; voice dictation via the
  Web Speech API; a custom rounded model dropdown.
- **The JSX layout:** the left rail (sidebar toggle, fullscreen, architecture, settings), the
  conversation **history sidebar** (rename/delete), the **top bar** (IE logo + name → new chat +
  theme toggle), the **canvas** (greeting → plan card → result tabs with preview/download), the
  **composer** (text + photo "+" + voice mic + model picker + send), the **Settings modal**, and
  the **Architecture overlay**. Each region is marked with a `{/* ... */}` comment.

### `web/app/globals.css`
All styling for the app (~1,419 lines). The top defines **design tokens** as CSS custom
properties for **light** (`:root` / `[data-theme="light"]`) and **dark** (`[data-theme="dark"]`):
colors, an 8px spacing scale, radii, the type scale, and shadows. Every component uses
`var(--token)` rather than hard-coded colors, which is why toggling `data-theme` reskins the whole
app at once. Below the tokens, the file is split into commented sections: base, app shell
(rail / top bar / canvas / composer), sidebar, the **custom cursor** (hides the native cursor on
every element), the model dropdown, theme toggle, greeting + **suggestion chips**, cards + plan
fields, buttons, status/progress, the photo dropzone, the result view, the composer (including the
**slimmed scrollbar with the native up/down arrow buttons removed**), the settings modal, and the
**architecture overlay + its all-white hover popover**.

### `web/app/api/plan/route.ts`
The **Strategist backend endpoint** (Plan Mode, step 1). Configured to run on the Node.js runtime,
`force-dynamic`, with `maxDuration = 60`. It reads `{ brief, model, credentials }` from the POST
body, then opens a `ReadableStream` and emits **SSE events**: a `progress` event (`PLAN_STEP`),
then either `done` with the finished `{ plan }` or `error` with a friendly `{ message }`. Running
server-side is what keeps the API keys out of the browser.

### `web/app/api/generate/route.ts`
The **Generator backend endpoint** (Plan Mode, step 2). Same SSE pattern as the plan route, but it
runs `runGenerator` and streams back `done { html }`. Its `maxDuration` is **300 s** (raised from
60 s): generating a full HTML page regularly took longer than a minute, so the old 60 s cap was
killing the function mid-call and leaving the UI hanging. It reads `{ plan, images, model,
credentials }` and validates that a well-formed `plan` is present before running.

### `web/components/ThemeToggle.tsx`
A small client button that flips `data-theme` between `light` and `dark`, persists the choice to
`localStorage`, and shows a sun/moon icon. On mount it syncs its state with whatever the no-flash
script in `layout.tsx` already applied. Because all colors are CSS variables, toggling re-skins the
entire app instantly.

### `web/components/CustomCursor.tsx`
The **Figma-style arrow cursor** mounted app-wide. It's engineered to avoid the usual custom-cursor
bugs: it hides the native cursor on *every* element (`html.cursor-on *`) so there's never a second
pointer; it follows the mouse by writing `transform` **directly on a ref** in the `mousemove`
handler (no React re-render, so no lag); it is `pointer-events: none` so clicks, drags, and text
selection pass straight through to the real (hidden) pointer; it hides when the pointer leaves the
window or the tab loses focus; and it **disables itself on touch / coarse-pointer devices**.

### `web/components/ArchitectureDiagram.tsx`
The **in-app architecture view**, drawn as a hand-built SVG: a dotted background, layered
containers (Client / Vercel / Agents / Provider seam / LLM), colored boxes, and labeled elbow
connectors. It holds the box layout data (`BOXES`, `LAYERS`, `EDGES`) and an `INSIGHTS` map with a
short **why / what / input / output** for each box, shown in a dark **hover popover** (text is all
white for readability). It's purely presentational/educational — no data flows through it.

### `web/lib/types.ts`
The shared TypeScript **data contracts** that the frontend, agents, and API routes all agree on:
`Shop` (business basics the Strategist extracts), `Strategy` (the marketing decisions), and `Plan`
(`business` + `strategy` + `framerId`, the chosen design style). It also exports `BUSINESS_GOALS`
(the fixed list of page goals), `MODELS` + `DEFAULT_MODEL` (the model picker options), and the
`PLAN_STEP` / `BUILD_STEP` progress strings. Defining shapes in one place means TypeScript flags
any misuse across the app.

### `web/lib/llm.ts`
The **provider seam** — the single place that talks to an AI provider. The rest of the app only
calls `callModel(prompt, temperature, model?, creds?)`, which routes to **`callGemini`** (the
Gemini Developer API, one API key) or **`callVertex`** (Vertex AI on Google Cloud, a service
account + region) based on the `LLM_PROVIDER` env var or per-request `Credentials` from the
Settings panel. `serviceAccountCredentials` parses the Vertex JSON (accepting raw JSON *or* base64,
tolerating stray quotes/whitespace — defensive code that fixed a real deploy bug). The
architectural point: switching providers requires **zero changes to the agents**.

### `web/lib/agents.ts`
The **two agents and their prompts** — the brains. Helper functions used around the model call:
`parseJson` (strips markdown fences, parses the plan JSON), `injectImages` (swaps `IMAGE_1…n`
placeholder tokens for the real base64 photos after generation), `openLinksInNewTab` (makes the
generated page's CTAs open in a new tab inside the preview iframe), `ctaLinkFor` (turns the chosen
goal into a real link — a Maps search, a mailto, etc., so no button is dead), and `imagesBlock`
(the photo instructions injected into the Generator prompt).
- **`runStrategist`** builds the Strategist prompt ("senior brand strategist": extract the business
  basics, make the marketing decisions, and **pick the best-fitting framer** from the catalog),
  calls the model at **temperature 0.6** (focused), then resolves the chosen framer with a random
  fallback and returns a typed `Plan`.
- **`runGenerator`** injects the chosen framer's full design spec (`framerPromptBlock`) plus the
  approved strategy, page structure, and photo rules into the "boutique designer" prompt, calls the
  model at **temperature 0.8** (more creative), strips fences, swaps the `IMAGE_n` tokens for real
  photos, and opens CTA links in new tabs.

### `web/lib/framers.ts`
The **design-system catalog** the Generator builds pages in. It defines the `Framer` shape and
`FRAMERS` — five distinct, generically-named looks (**Cinematic Noir, Warm Editorial, Violet
Precision, Scarlet Impact, Neon Pulse**), each with a palette (hex + usage), a type scale, radius,
spacing, fonts, and the **signature patterns** that make a page read as that style. Selection
helpers: `getFramer` (lookup by id), `randomFramerId` (the fallback), `resolveFramerId` (keep the
model's pick if valid, otherwise random), `framerCatalogForPrompt` (the compact menu shown to the
Strategist), and `framerPromptBlock` (the full spec injected into the Generator prompt). The
Strategist chooses one from the brief; the user can override it in the plan card.

### `web/lib/graph.ts`
The same **Strategist → Generator pipeline expressed as a LangGraph.js `StateGraph`** — a
`PipelineState` (brief, model, images, plan, html), a `strategistNode` and `generatorNode`, edges
`START → strategist → generator → END`, lazily compiled via `getGraph()`. In the live app the two
agents run as **separate web requests** (`/api/plan` then `/api/generate`) so the human can approve
in between, so this file is **not on the request path**; it's the canonical, non-interactive view
that documents the multi-agent structure in code (and a base for a future one-shot path / tests).

### `web/public/ie-logo.png`
The IE University logo (binary asset). Used as the browser **favicon** (via `layout.tsx` metadata)
and as the **brand mark** in the top bar — rendered white in dark mode via CSS.

### `web/package.json`
The npm manifest. **Scripts:** `dev` (`next dev`), `build` (`next build` — also the type-check /
quality gate that must pass before deploy), `start`, `lint`. **Runtime dependencies:** `next`
14.2.5 + `react`/`react-dom` 18; the two Google model SDKs (`@google/generative-ai` for the Gemini
API path, `@google-cloud/vertexai` for the Vertex path); and `@langchain/langgraph` +
`@langchain/core` for the graph. **Dev dependencies:** TypeScript 5 and the `@types/*` packages.

### `web/tsconfig.json`
The TypeScript compiler config. Key settings: `strict` on (the build fails on type errors),
`noEmit` (Next handles emit), `moduleResolution: "bundler"`, `jsx: "preserve"`, and the **`@/*`
path alias** mapping to the project root — that's why imports read `@/lib/agents`, `@/components/…`.

### `web/next.config.mjs`
The Next.js configuration. Its single job is to list the **server-only SDKs**
(`@langchain/langgraph`, `@google-cloud/vertexai`) under `serverComponentsExternalPackages` so Next
never tries to bundle them into the browser — they run only inside the server-side API routes.

### `web/vercel.json`
The Vercel deployment config. It pins the **framework to Next.js** (which fixed an earlier
"missing public directory" detection error). Deliberately minimal; the **Root Directory = `web`**
is set in the Vercel dashboard, not here.

### `web/next-env.d.ts`
Auto-generated by Next.js (and gitignored). It supplies ambient TypeScript types for Next.js; it is
never edited by hand.

### `web/.gitignore`
Ignores `node_modules`, the `.next` / `out` / `build` outputs, **all env files** (`.env`,
`.env*.local` — so secrets are never committed), the `.vercel` folder, log files, `*.pem`, and the
generated `next-env.d.ts`.

### `web/.env.local`
**Local-only** secrets and config (gitignored — not in the repo). Holds `LLM_PROVIDER` and the
provider credentials: either `GEMINI_API_KEY`, or the Vertex set (`GOOGLE_CLOUD_PROJECT`,
`GOOGLE_CLOUD_LOCATION`, `GOOGLE_SERVICE_ACCOUNT_JSON`). On Vercel the same keys live under
**Settings → Environment Variables**. The full list is documented in `web/README.md`.

### `web/README.md`
The web app's **setup and deployment guide**: how to run locally (Node 20+), the two provider
config options (Gemini API vs Vertex AI), the full Vertex AI / Google Cloud setup steps
(project, billing, API enable, service account + key, base64 for Vercel), and the Vercel deploy
steps (Root Directory = `web`, env vars).

### `web/AGENT.md`
The frontend's **single source of truth**: the architecture overview, design principles, the full
design-token table (fonts / colors / spacing / radius / type scale), component rules, the model
list, and **§8 — the framer design-system catalog and its selection logic** for generated pages.
Read it before changing the UI.

---

## 5. Likely Q&A questions & crisp answers

**Q: Why two agents instead of one prompt?**
Strategy and execution are different jobs. One prompt that does both defaults to generic copy.
Splitting them forces the marketing decisions to happen first, independently, and lets a human
approve them before any page is built.

**Q: Where is the "human-in-the-loop"?**
Between the two agents: the Strategist's plan is shown as an **editable card** (including the design
style) and nothing is built until the user clicks **Confirm & build**.

**Q: How do the frontend and backend talk in real time?**
The browser calls the API routes with `fetch`; the routes stream back **Server-Sent Events**
(progress, then the result). The UI updates live as each event arrives.

**Q: How is it model-agnostic / how would you swap providers?**
Every model call goes through one function, `callModel` in `lib/llm.ts` (the provider seam).
Switching `LLM_PROVIDER` between `gemini` and `vertex` — or letting a user paste their own keys in
Settings — changes the provider with **no change to the agents or the UI**.

**Q: How does it pick a design style?**
The Strategist chooses a **framer** from the catalog in `lib/framers.ts` based on the brief; if it
can't decide, a random valid one is used. The choice is editable in the plan card, and the
Generator builds the page strictly to that framer's spec.

**Q: How do you keep API keys safe?**
Model calls only happen in the API routes, which run **on the server** (`runtime = "nodejs"`). Keys
are never sent to or exposed in the browser, and the server-only SDKs are excluded from the client
bundle in `next.config.mjs`.

**Q: What stops the AI from producing a broken/dead page?**
The Generator is forced to use real CTA links (`ctaLinkFor`), real photos via `IMAGE_n` tokens, a
strict structure, and a concrete framer design spec. The Strategist must return a **strict JSON
shape** that the typed code validates.

**Q: How are photos handled?**
They're resized in the browser and converted to **base64**, sent to the Generator route, and
embedded directly into the single HTML file. The Generator references them as `IMAGE_1…n` tokens,
which are swapped for the real images afterward.

**Q: Where does state live?**
Transient UI state in React (`useState`); conversation history, settings, and theme persist in the
browser's `localStorage`; the plan/HTML flow through typed objects between the agents.

**Q: What's the cost / latency profile?**
Two Gemini calls per page — one cheap Strategist call (~5–15 s) and one Generator call (which can
exceed a minute for a full page). The generate route allows up to **300 s**, and the client surfaces
an error if a request ends without a result rather than hanging.
