# web/AGENT.md — Frontend Single Source of Truth

Operating guide + design system for the **PageForge web app** (`web/`). Read this
before changing the UI. It exists so any contributor (and their AI) has one place
that defines *how this frontend is built and how it should look*.

> Methodology borrowed from the Framer design-md convention
> (github.com/VoltAgent/awesome-design-md) — a strict token table plus explicit
> do/don't rules. The **aesthetic** here is **Apple**, not Framer: system fonts,
> light **and** dark mode, monochrome surfaces, one vibrant accent for active
> states. (Framer's system is dark-only with brand fonts; we deliberately diverge.)

---

## 1. Architecture

Next.js 14 (App Router) + TypeScript, deployed on Vercel (`Root Directory = web`).
**This `web/` app is the UI only.** The agents/graph/LLM seam now live in a
separate **Python backend** (`../server`, FastAPI + LangGraph); the frontend calls
same-origin `/api/plan` and `/api/generate`, which `next.config.mjs` **rewrites**
to that backend (`PY_BACKEND_URL`, default `http://127.0.0.1:8000`). The model
provider is swappable via `LLM_PROVIDER` (`gemini | vertex`) behind one seam,
`../server/app/llm.py`. Two agents (`../server/app/agents.py`):

- **Strategist** — turns the user's free-form brief into a structured *plan*
  (extracted business basics + marketing strategy).
- **Generator** — turns an *approved* plan (+ optional photos) into a single,
  self-contained, downloadable HTML landing page.

### Plan Mode (human-in-the-loop)

The defining flow. The agent never jumps straight to generating:

```
user brief ──▶ /api/plan  (Strategist)  ──▶ editable PLAN CARD
                                               │ user confirms / edits
                                               ▼
                       /api/generate (Generator) ──▶ landing page in canvas
```

This is the same "interrupt before you act" idea as the original graph: produce a
plan, wait for explicit human confirmation, then execute. It keeps generations
cheap, predictable, and correctable.

### File map

```
app/
  layout.tsx              html shell + no-flash theme script
  page.tsx                the chat UI: composer, plan card, result canvas
  globals.css             the design tokens (this doc, in CSS) + base styles
  api/plan/route.ts       Strategist -> plan (SSE)
  api/generate/route.ts   Generator  -> html (SSE)
components/
  ThemeToggle.tsx         light/dark switch (top-right)
lib/
  types.ts                Shop / Strategy / Plan types, MODELS, business goals
  llm.ts                  provider seam: gemini | vertex, per-request model
  agents.ts               runStrategist (brief->plan), runGenerator (plan->html)
  framers.ts              the design-system catalog for GENERATED pages (§8)
  graph.ts                LangGraph.js view of the strategist->generator pipeline
```

---

## 2. Design principles

1. **Binary hierarchy.** Text is either `--ink` or `--ink-muted`. No in-between
   grays for type. (Framer rule, kept.)
2. **Monochrome + one accent.** Surfaces are neutral; `--accent` (Apple blue) is
   used *only* for the active/selected/focused state and the primary action.
   Never as a large fill or a brand background.
3. **Elevation over color.** Priority is shown by surface step and shadow, not by
   saturating color.
4. **Negative tracking on display sizes.** Large headings pull letter-spacing
   tighter (Apple/Framer signature). Body stays near-neutral.
5. **Generous whitespace, calm motion.** 8px spacing scale. Transitions are
   subtle (opacity / transform / 150–200ms), never bouncy.
6. **Light and dark are equals.** Every token has a value in both themes; nothing
   is hard-coded to a hex in components — always `var(--token)`.

---

## 3. Design tokens

Implemented in `app/globals.css` as CSS custom properties on `:root` (light) and
`[data-theme="dark"]`.

### Fonts

```
--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
             "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

### Color palette

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--bg` | `#fbfbfd` | `#000000` | Page canvas |
| `--surface-1` | `#ffffff` | `#1c1c1e` | Cards, composer, raised UI |
| `--surface-2` | `#f5f5f7` | `#2c2c2e` | Insets, hover, selected rows |
| `--ink` | `#1d1d1f` | `#f5f5f7` | Headlines, primary text |
| `--ink-muted` | `#6e6e73` | `#86868b` | Secondary text, meta |
| `--border` | `#d2d2d7` | `#38383a` | Hairlines, input borders |
| `--accent` | `#0071e3` | `#2997ff` | Active/selected/focus, primary CTA |
| `--accent-hover` | `#0077ed` | `#4aa8ff` | CTA hover |
| `--accent-soft` | `rgba(0,113,227,.10)` | `rgba(41,151,255,.15)` | Focus ring, selected bg |
| `--danger` | `#d70015` | `#ff453a` | Errors |

### Spacing (8px base)

`--space-1:4px · --space-2:8px · --space-3:12px · --space-4:16px · --space-6:24px · --space-8:32px · --space-12:48px · --space-16:64px`

### Radius

`--radius-sm:8px · --radius-md:12px · --radius-lg:18px · --radius-xl:24px · --radius-pill:980px`
(Apple uses large, soft corners and fully-round pills for buttons.)

### Type scale

| Token | Size | Weight | Letter-spacing |
|---|---|---|---|
| `--text-display` | 48px | 600 | -0.03em |
| `--text-title` | 28px | 600 | -0.02em |
| `--text-h2` | 20px | 600 | -0.015em |
| `--text-body` | 15px | 400 | -0.01em |
| `--text-small` | 13px | 400 | 0 |

### Elevation

`--shadow-1` (cards) and `--shadow-2` (floating composer/popovers) — softer and
lighter in light mode, near-invisible in dark mode where `--border` carries the
edge instead.

---

## 4. Component rules

- **Buttons** are pills (`--radius-pill`). Primary = `--accent` fill, white text.
  Secondary = `--surface-2` fill, `--ink` text. No bordered ghost buttons as the
  primary action. Hover = subtle bg shift; pressed = `transform: scale(.98)`.
- **Composer** (the bottom input) is a floating `--surface-1` pill with
  `--shadow-2`, centered, max-width ~760px. Focus raises the accent ring
  (`--accent-soft`). A "+" attaches photos; the send button is an accent circle.
- **Plan card** is a `--surface-1` card (`--radius-lg`, `--shadow-1`) with the
  extracted fields as editable inputs, and two actions: **Confirm & build**
  (primary) and **Edit brief** (secondary).
- **Inputs** use `--surface-2` bg (or transparent inside cards), `--border`
  hairline, `--radius-md`, and an `--accent` focus ring.
- **Model dropdown** sits inside the composer (bottom input bar, ChatGPT/Gemini
  style); the selected model drives the backend per-request.

---

## 5. Theme

- Toggle lives in the **top-right** of the top bar (the demo's "Upgrade" slot).
- Default follows `prefers-color-scheme`; user choice persists in
  `localStorage["theme"]`.
- `layout.tsx` sets `document.documentElement.dataset.theme` via an inline script
  **before paint** to avoid a flash of the wrong theme.
- Components read only `var(--token)` — switching `data-theme` reskins everything.

---

## 6. Models

`lib/types.ts` exports `MODELS` (Google/Vertex ids). Default selected = the latest
Flash model. The selected id is sent with every request and overrides
`GEMINI_MODEL` for that call.

```
gemini-2.5-flash   (default — fast, cheap, the demo workhorse)
gemini-2.5-pro     (higher quality, slower)
gemini-2.0-flash   (fallback)
```

Add others by extending `MODELS` (in `lib/types.ts` for the picker UI, and
`../server/app/types.py` for the backend); no other change needed —
`../server/app/llm.py` already accepts a per-request model on both the Gemini API
and Vertex paths.

---

## 7. Do / Don't

**Do**
- Use `var(--token)` for every color, space, radius — never a raw hex in a component.
- Keep type to `--ink` / `--ink-muted` only.
- Reserve `--accent` for active/selected/focus and the one primary action per view.
- Test both themes after any visual change.

**Don't**
- Don't hard-code colors or add a third text gray.
- Don't use `--accent` as a section background or large fill.
- Don't add bouncy/elaborate motion — keep it Apple-calm.
- Don't bypass Plan Mode (no "submit → immediately generate").
- Don't read provider keys on the client; all model calls are server-side.

---

## 8. Framers — design systems for GENERATED pages

> Scope: this section is about the **landing pages the Generator produces**, NOT
> the PageForge app chrome (that stays Apple, §2–§5). A "framer" is one
> self-contained look the output page is built in.

The catalog lives in [`lib/framers.ts`](lib/framers.ts) as structured data the
agent reads at runtime — colors, fonts, type scale, radius, spacing and the
*signature patterns* that make a page unmistakably that brand. Specs are
distilled from VoltAgent's `awesome-design-md`
(github.com/VoltAgent/awesome-design-md, `design-md/<brand>/DESIGN.md`).

### The catalog (5 distinct looks)

Names are generic by design (no source brands). The underlying CSS `font-family`
values are kept verbatim for fidelity but are never shown in the picker.

| id | name | feel | best for |
|---|---|---|---|
| `cinematic-noir` | Cinematic Noir | refined near-black, one racing red | luxury, automotive, fine dining, jewelry, premium |
| `warm-editorial` | Warm Editorial | warm cream, pill shapes, orbital circles | payments, finance, corporate/B2B, professional services |
| `violet-precision` | Violet Precision | crisp white tech canvas, bold purple | crypto/fintech, exchanges, B2B SaaS, tech, data-driven |
| `scarlet-impact` | Scarlet Impact | huge uppercase display over photos, scarlet CTA | telecom, big consumer/retail, services, events, bold |
| `neon-pulse` | Neon Pulse | immersive near-black, one electric-green accent | music/audio, entertainment, media, creative, nightlife, apps |

### Selection logic (prompt-driven, random fallback)

1. **Strategist picks it** — `run_strategist` (`../server/app/agents.py`)
   shows the model the catalog (`framer_catalog_for_prompt()`) and asks it to choose
   one `design_system` id that matches the business + tone, or `""` if unsure.
2. **Random fallback** — `resolveFramerId()` keeps the model's pick **only if it
   names a real framer**; otherwise it returns a random valid id. So an empty /
   unknown / hallucinated value always degrades to a random framer, never breaks.
   The result is stored as `Plan.framerId`.
3. **Human override** — the Plan card exposes a "Design style" `<select>`
   ([`app/page.tsx`](app/page.tsx)) so the user can change the framer before
   building. Legacy saved plans without a `framerId` are normalised on load.
4. **Generator applies it** — `runGenerator` injects `framerPromptBlock(framerId)`
   into the prompt as a hard DESIGN SYSTEM spec; the generic "pick your own
   colors/fonts" guidance was removed so the framer is the single source of truth.

### Fonts

Brand font-family names are kept **verbatim** as the primary family, each with a
graceful fallback chain. Proprietary faces (FerrariSans, MarkForMC, Kraken-Brand,
Vodafone, SpotifyMixUI, …) simply fall back — they are **never** swapped for a
different font. Where a face is free (Sofia Sans for `warm-editorial`, IBM Plex
Sans for `violet-precision`) the page loads it via a Google Fonts `<link>`.

### Adding / editing a framer

Append a `Framer` object to `FRAMERS` in `lib/framers.ts` (copy tokens from the
matching `design-md/<brand>/DESIGN.md`). Set a sharp `bestFor` — that string is
what the Strategist matches on. No other change is needed: the picker, selection
and generator prompt all read the catalog.
