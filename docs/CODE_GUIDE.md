# PageForge — Code Guide

A detailed, file-by-file walkthrough of the whole codebase. For each file you get the **code**
and, beside it, a **plain-English explanation** of what it does and *why*. Use it to prepare
for the Q&A — by the end you should be able to point at any part of the app and say what's
happening behind it.

> The app lives in the **`web/`** folder. Everything below refers to files under `web/`.

---

## 0. The big picture in one minute

PageForge takes a sentence about a business and produces a finished landing page — but it does
it in **two stages with a human checkpoint in between**:

1. **You describe a business** in the chat box.
2. The **Strategist** (an AI agent) turns that into a **marketing plan** (positioning, audience,
   tone, key messages) and shows it to you.
3. **You review and approve** the plan (you can edit it). *This is the human-in-the-loop gate.*
4. The **Generator** (a second AI agent) turns the approved plan + your photos into a complete
   **HTML landing page** you can preview and download.

Both agents are powered by **Google Gemini 2.5 Flash**. The app runs on **Next.js** (which is
both the website *and* the small backend), deployed on **Vercel**.

```
Browser (chat UI)  ──POST /api/plan──▶  Strategist agent ──▶ Gemini ──▶ marketing plan
        ▲                                                                     │
        │  you approve / edit the plan  ◀─────────────────────────────────────┘
        │
        └──POST /api/generate──▶ Generator agent ──▶ Gemini ──▶ HTML landing page
```

---

## 1. Glossary (plain English)

| Term | What it means here |
|---|---|
| **Next.js** | A framework that lets one project be both the website (frontend) and a small backend (API). |
| **App Router** | The Next.js folder convention where files in `app/` become pages and API endpoints. |
| **Component** | A reusable piece of UI written in React (e.g. the theme toggle, the cursor). |
| **State** | Data the UI remembers and reacts to (e.g. "are we planning or building right now?"). |
| **API route** | A backend function that runs on the server, not in the browser (used to call the AI safely). |
| **Serverless** | Code that runs on Vercel's servers on demand — no server to manage. |
| **LLM** | Large Language Model — the AI (here, Google Gemini) that generates text. |
| **Prompt** | The instructions we send to the LLM telling it exactly what to produce. |
| **Agent** | An LLM given a specific job + prompt (we have two: Strategist and Generator). |
| **Provider seam** | One function (`callModel`) that hides *which* AI provider we use, so we can swap them. |
| **SSE (Server-Sent Events)** | A way for the server to stream updates to the browser live (the "Strategist is working…" progress). |
| **base64** | A way to turn an image file into a long text string so it can be embedded directly in the HTML. |
| **localStorage** | A small storage area in the browser that remembers things between visits (history, settings). |

---

## 2. Project map

```
web/
├── app/
│   ├── layout.tsx              The shell wrapping every page (theme, favicon, custom cursor).
│   ├── page.tsx                The entire UI + the client-side logic of the flow. (the big file)
│   ├── globals.css             All styling: design tokens (colors/spacing) + every component's CSS.
│   └── api/
│       ├── plan/route.ts       Backend endpoint that runs the Strategist (streams progress).
│       └── generate/route.ts   Backend endpoint that runs the Generator (streams the HTML).
├── components/
│   ├── ThemeToggle.tsx         The light/dark switch.
│   ├── CustomCursor.tsx        The Figma-style cursor.
│   └── ArchitectureDiagram.tsx The in-app architecture diagram (with hover explainers).
├── lib/
│   ├── types.ts                The shared "shapes" of our data (Plan, Strategy, etc.).
│   ├── llm.ts                  The provider seam: one place that talks to Gemini / Vertex.
│   ├── agents.ts               The two agents and their prompts. (the brains)
│   └── graph.ts                The two-agent pipeline expressed as a LangGraph graph.
└── public/ie-logo.png          The IE University logo (favicon).
```

---

## 3. The data flow, step by step

1. You type a brief and press send. `page.tsx` calls **`POST /api/plan`** with your text.
2. `api/plan/route.ts` calls **`runStrategist()`** (in `lib/agents.ts`).
3. `runStrategist` builds a prompt and calls **`callModel()`** (in `lib/llm.ts`), which sends it
   to **Gemini** and returns a marketing plan as JSON.
4. The plan streams back to the browser; `page.tsx` shows it as an **editable plan card**.
5. You approve. `page.tsx` calls **`POST /api/generate`** with the (edited) plan + your photos.
6. `api/generate/route.ts` calls **`runGenerator()`**, which prompts Gemini to write a full HTML page.
7. The HTML streams back; `page.tsx` shows it in a preview and offers a **Download** button.

Everything that touches an **API key happens on the server** (`api/*`), never in the browser.

---

## 4. File-by-file walkthrough

### `web/lib/types.ts` — the shared data shapes

These are the "contracts" that the frontend and backend both agree on, so the plan the
Strategist produces is exactly the shape the Generator (and the UI) expect.

```ts
// "Shop" = the business basics the Strategist extracts from your brief.
export interface Shop {
  name: string;
  businessType: string;
  location: string;
  address?: string;     // optional ("?" means it can be missing)
  goal: string;
}

// "Strategy" = the marketing decisions the Strategist makes.
export interface Strategy {
  positioning: string;
  target_customer: string;
  value_proposition: string;
  tone: string;
  conversion_goal: string;
  key_messages: string[];   // a list of strings
}

// "Plan" = what you approve in Plan Mode = the business basics + the strategy.
export interface Plan {
  business: Shop;
  strategy: Strategy;
}

// The fixed list of page goals the user/Strategist can pick from.
export const BUSINESS_GOALS = [ "Get people to visit in person", /* ... */ ] as const;

// The models offered in the picker, and the default one.
export const MODELS = [ { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }, /* ... */ ];
export const DEFAULT_MODEL = "gemini-2.5-flash";

// The text shown while each agent works (streamed to the UI).
export const PLAN_STEP = "Strategist is analysing your business and planning the strategy…";
export const BUILD_STEP = "Generator is building your landing page…";
```

**Why it matters:** defining the shapes in one place means TypeScript will warn us if any part
of the app uses the data wrong — this is a big part of "technical robustness."

---

### `web/lib/llm.ts` — the provider seam (the swappable model)

This is the single place that talks to an AI provider. The rest of the app only calls
`callModel(...)` and never needs to know *which* provider is active. That's the architectural
point: **we can switch from Gemini API to Vertex AI by changing one setting, with zero changes
to the agents.**

```ts
// Which provider is active by default (from an environment variable).
export function activeProvider(): "gemini" | "vertex" {
  return (process.env.LLM_PROVIDER || "gemini").toLowerCase() === "vertex" ? "vertex" : "gemini";
}

// Optional per-request overrides — lets a user run on THEIR OWN keys (Settings panel).
export interface Credentials {
  provider?: "gemini" | "vertex";
  geminiApiKey?: string;
  vertexProject?: string;
  vertexLocation?: string;
  vertexServiceAccountJson?: string;
}

// THE ONE FUNCTION the agents call. It picks the provider, then delegates.
export async function callModel(prompt, temperature = 0.7, model?, creds?) {
  const modelName = model || MODEL_NAME;           // which Gemini model
  const provider = creds?.provider || activeProvider();
  return provider === "vertex"
    ? callVertex(prompt, temperature, modelName, creds)
    : callGemini(prompt, temperature, modelName, creds);
}
```

- **`callGemini`** uses the simple Gemini API (one API key). It creates the client, picks the
  model + a `temperature` (how "creative" the output is), sends the prompt, and returns the text.
- **`callVertex`** uses Google Cloud's Vertex AI (a service-account credential + region). Same
  idea, different authentication.
- **`serviceAccountCredentials`** is a small helper that reads the Vertex credential — it
  accepts the JSON either as raw text *or* as a base64 string (base64 is easier to paste into a
  hosting dashboard), and tolerates stray quotes/whitespace. This is defensive code that fixed a
  real deployment bug.

**`temperature`** is set to **0.6 for the Strategist** (more focused/consistent decisions) and
**0.8 for the Generator** (a bit more creative for the page copy/design).

---

### `web/lib/agents.ts` — the two agents (the brains)

This file contains the two agents and, crucially, **their prompts** — the instructions that turn
a general AI into a "brand strategist" and a "boutique web designer."

**Helper functions** (used after the AI responds):
- `parseJson` — strips any markdown fences the model adds and parses the plan JSON.
- `injectImages` — the Generator is told to write `IMAGE_1`, `IMAGE_2` placeholders instead of
  giant base64 strings (so its output stays small). Afterwards this swaps those tokens for the
  real images.
- `openLinksInNewTab` — makes the generated page's buttons open in a new tab (so they work
  inside the preview iframe).
- `ctaLinkFor` — turns the chosen "goal" into a real button link (a Google Maps search for
  "visit in person", a mailto link for bookings, etc.) so no button is dead.

**Agent 1 — the Strategist** (`runStrategist`):

```ts
export async function runStrategist(brief, model?, creds?): Promise<Plan> {
  const prompt = `You are a senior brand strategist for small and medium businesses.
A business owner describes their business and what they want, in their own words.
First EXTRACT the business basics, then MAKE the marketing decisions.
Do NOT write any website copy yet.

OWNER'S BRIEF:
"""
${brief}
"""
...
Return ONLY a JSON object, no markdown:
{ "business": { ... }, "strategy": { positioning, target_customer, value_proposition, ... } }`;

  // 0.6 = focused. We parse the JSON the model returns into a typed Plan.
  return parseJson(await callModel(prompt, 0.6, model, creds)) as Plan;
}
```

The prompt does three important things: (1) tells the model *who it is* ("senior brand
strategist"), (2) forbids writing the page yet (strategy must come first), and (3) demands a
**strict JSON shape** so our code can read it reliably.

**Agent 2 — the Generator** (`runGenerator`):

```ts
export async function runGenerator(plan, images, model?, creds?): Promise<string> {
  const ctaLink = ctaLinkFor(plan.business);
  const prompt = `You are a senior designer at a boutique branding studio ...
Build a complete, single-file HTML landing page for this business,
executing the marketing strategy below precisely.

STRATEGY:
${JSON.stringify(plan.strategy, null, 2)}
... STRUCTURE (nav, hero, why-us grid, about, social proof, footer) ...
... DESIGN BAR (one color story, real fonts, spacing, hover states) ...
... RULES (one self-contained file, real CTA links, use the photos) ...`;

  const raw = await callModel(prompt, 0.8, model, creds);   // 0.8 = more creative
  let html = raw.trim()...;            // remove any markdown fences
  html = injectImages(html, images);  // swap IMAGE_n tokens for the real photos
  return openLinksInNewTab(html);      // make CTAs open in a new tab
}
```

The Generator prompt is long on purpose — most of it is a **"design bar"** that fixes the
things AI pages usually get wrong (rainbow gradients, default fonts, cramped spacing). It is
*given* the approved strategy, so it can't drift off-brand.

> **Key talking point:** the two agents are deliberately separate. The Strategist can't write
> the page; the Generator can't change the strategy. The human approves in between.

---

### `web/lib/graph.ts` — the pipeline as a LangGraph graph

This expresses the same two-agent pipeline as a **LangGraph** graph (a standard way to draw
agent workflows as nodes + edges). In the live app we actually run the two agents as two
separate web requests (so the human can approve in the middle), but this file documents the
canonical flow and satisfies the "multi-agent orchestration" requirement in code.

```ts
export const PipelineState = Annotation.Root({   // the data passed between nodes
  brief: ..., model: ..., images: ..., plan: ..., html: ...,
});

function buildGraph() {
  return new StateGraph(PipelineState)
    .addNode("strategist", strategistNode)   // node 1
    .addNode("generator", generatorNode)     // node 2
    .addEdge(START, "strategist")            // start → strategist
    .addEdge("strategist", "generator")      // strategist → generator
    .addEdge("generator", END)               // generator → end
    .compile();
}
```

---

### `web/app/api/plan/route.ts` — the Strategist endpoint (streaming)

This is a **backend** function (it runs on Vercel's servers, where the API keys live safely).
It receives your brief, runs the Strategist, and **streams** progress + the result back.

```ts
export const runtime = "nodejs";          // run on the Node server (not the edge)
export const maxDuration = 60;            // allow up to 60s (the AI can take a while)

export async function POST(req: Request) {
  const body = await req.json();          // read { brief, model, credentials }
  const brief = ...; const model = ...; const credentials = ...;

  // A ReadableStream lets us push events to the browser as they happen.
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        send("progress", { label: PLAN_STEP });          // "Strategist is analysing…"
        const plan = await runStrategist(brief, model, credentials);
        send("done", { plan });                          // the finished plan
      } catch (err) {
        send("error", { message: err.message });         // a friendly error
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", ... } });
}
```

The funny `event: ... \n data: ... \n\n` format is the **Server-Sent Events** protocol — it's how
the server streams the live "progress" updates and then the final "done" payload to the browser.

`web/app/api/generate/route.ts` is the **same pattern**, but it runs `runGenerator` and streams
back the finished `{ html }`.

---

### `web/app/layout.tsx` — the app shell

Wraps every page. It does three small but important things:

```ts
export const metadata = {
  title: "PageForge",                       // the browser tab title
  icons: { icon: "/ie-logo.png" },          // the IE logo as the favicon
};

// This tiny script runs BEFORE the page paints, so the correct light/dark theme
// is applied immediately (no white flash on a dark-mode load).
const themeScript = `... document.documentElement.dataset.theme = stored || system; ...`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}            {/* the actual page */}
        <CustomCursor />      {/* the Figma-style cursor, app-wide */}
      </body>
    </html>
  );
}
```

---

### `web/app/page.tsx` — the entire UI + the flow (the big file)

This is the heart of the frontend. It's large, so here are the parts that matter for the Q&A.

**1) The "state machine."** The app is always in one of these phases, and the UI changes based
on which one it's in:

```ts
type Phase = "idle" | "planning" | "plan" | "building" | "done";
```

- `idle` — waiting for you to type a brief.
- `planning` — the Strategist is running (spinner + progress).
- `plan` — the editable plan card is shown for approval.
- `building` — the Generator is running.
- `done` — the finished page is shown (preview + download).

**2) The state we keep** (using React's `useState`): the chosen `model`, the `brief` text, the
current `plan`, the generated `html`, the list of `conversations` (saved to `localStorage`), the
`settings` (credentials), and small UI flags (sidebar open, theme, etc.).

**3) Talking to the backend — `streamSSE`.** This one helper reads the streamed events from an
API route and calls back for each one:

```ts
async function streamSSE(url, body, onEvent) {
  const res = await fetch(url, { method: "POST", body: JSON.stringify(body), ... });
  const reader = res.body.getReader();           // read the stream chunk by chunk
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");          // each SSE event ends with a blank line
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      // parse "event: X" and "data: {...}" out of the frame, then:
      onEvent(event, JSON.parse(data));
    }
  }
}
```

**4) Step 1 — submit the brief (`submitBrief`).** Sets phase to `planning`, calls `/api/plan`,
and reacts to the streamed events:

```ts
await streamSSE("/api/plan",
  { brief: text, model, credentials: credentialsFromSettings(settings) },
  (event, payload) => {
    if (event === "progress") setSteps((s) => [...s, payload.label]);     // show "analysing…"
    else if (event === "done") { setPlan(payload.plan); setPhase("plan"); } // show plan card
    else if (event === "error") { setError(payload.message); setPhase("idle"); }
  });
```

**5) Step 2 — confirm & build (`confirmBuild`).** Runs only after you approve. It converts your
photos to base64, sends the (edited) plan to `/api/generate`, and shows the streamed result:

```ts
const images = await Promise.all(files.map((f) => fileToDataUri(f)));   // photos → base64
await streamSSE("/api/generate",
  { plan: cleaned, images, model, credentials: credentialsFromSettings(settings) },
  (event, payload) => {
    if (event === "done") { setHtml(payload.html); setPhase("done"); }   // show the page
    ...
  });
```

**6) The rule that enforces "at least 3 photos":** the "Confirm & build" button is disabled
until `files.length >= 3`, and a friendly message asks for more.

**7) The rest of the file** is the JSX (the visual layout): the left rail (sidebar toggle,
fullscreen, architecture, settings), the conversation history sidebar (with rename/delete), the
top bar (IE logo + name + theme toggle), the main canvas (greeting → plan card → result), the
composer (text box + photo "+" + voice mic + model picker + send), the Settings modal, and the
Architecture view. Each section is marked with a `{/* ... */}` comment in the code.

---

### `web/components/ThemeToggle.tsx`

A small button that flips a `data-theme="light|dark"` attribute on the page and saves the choice
to `localStorage`. All colors are CSS variables that change with that attribute, so the whole
app re-skins instantly.

### `web/components/CustomCursor.tsx`

The Figma-style arrow cursor. **Why it has no bugs:** it hides the native cursor on *every*
element (`html.cursor-on * { cursor: none }`) so you never see two pointers; it follows the
mouse by writing `transform` directly (no React re-render, so no lag); and it's
`pointer-events: none`, so clicks/drags/selection pass straight through to the real pointer.

### `web/components/ArchitectureDiagram.tsx`

The in-app architecture diagram, drawn as an SVG (boxes, layered containers, arrows). It also
holds the **hover explainer** data — a short *why / what / input / output* for each box — shown
in a popover when you hover a box.

### `web/app/globals.css` — styling & design tokens

The top of this file defines **design tokens** — CSS variables for colors, spacing, radius, and
shadows, with a **light** set and a **dark** set:

```css
:root, [data-theme="light"] { --bg: #fbfbfd; --ink: #1d1d1f; --accent: #0071e3; ... }
[data-theme="dark"]         { --bg: #000000; --ink: #f5f5f7; --accent: #2997ff; ... }
```

Every component uses `var(--token)` instead of hard-coded colors, which is why switching theme
recolors everything at once. The rest of the file styles each piece of UI (composer, sidebar,
plan card, modal, etc.).

---

## 5. Likely Q&A questions & crisp answers

**Q: Why two agents instead of one prompt?**
Strategy and execution are different jobs. One prompt that does both defaults to generic copy.
Splitting them forces the marketing decisions to happen first, independently, and lets a human
approve them before any page is built.

**Q: Where is the "human-in-the-loop"?**
Between the two agents: the Strategist's plan is shown as an **editable card** and nothing is
built until the user clicks **Confirm & build**. It's the same "interrupt before you act" idea
as a human approving before sending.

**Q: How do the frontend and backend talk in real time?**
The browser calls the API routes with `fetch`; the routes stream back **Server-Sent Events**
(progress, then the result). The UI updates live as each event arrives — that's the real-time
integration pillar.

**Q: How is it model-agnostic / how would you swap providers?**
Every model call goes through one function, `callModel` in `lib/llm.ts` (the "provider seam").
Switching `LLM_PROVIDER` between `gemini` and `vertex` — or letting a user paste their own keys
in Settings — changes the provider with **no change to the agents or the UI**.

**Q: How do you keep API keys safe?**
Model calls only happen in the API routes, which run **on the server** (`runtime = "nodejs"`).
Keys are never sent to or exposed in the browser.

**Q: What stops the AI from producing a broken/dead page?**
The Generator is forced to use real CTA links (`ctaLinkFor`), real photos via `IMAGE_n` tokens,
and a strict structure + "design bar." The Strategist is forced to return a **strict JSON
shape** that our typed code validates.

**Q: What guardrails / robustness do you have?**
Strict typed data shapes; the credential parser tolerates malformed input; errors are caught and
streamed back as friendly messages; the build type-checks the whole app before deploy; and the
two-agent split + human approval prevents runaway generation.

**Q: How are photos handled?**
They're resized in the browser and converted to **base64** so they can be embedded directly into
the single HTML file (no external hosting). The Generator references them as `IMAGE_1…n` tokens,
which we swap for the real images afterward.

**Q: Where does state live?**
Transient UI state in React (`useState`); conversation history and settings persist in the
browser's `localStorage`; the plan/HTML flow through typed objects between the agents.

**Q: What's the cost / latency profile?**
Two Gemini 2.5 Flash calls per page (one cheap Strategist call ~5–15s, one Generator call
~20–40s), streamed so the user sees progress the whole time.
