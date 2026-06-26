# BrewPage — AI Marketing Strategy → Landing Page Engine

Individual project for **Big Data & AI in Marketing**.
Topic: *Generative AI in content creation / AI-powered marketing workflows.*

A **three-agent LangGraph pipeline** for independent coffee shops: it makes the marketing
*decisions* a strategist would (positioning, audience, value proposition, tone, conversion
goal) before generating a single line of copy, then renders those decisions into a real,
styled landing page — optionally built around the shop's own uploaded photos — and lets the
owner iterate on the result with a feedback loop handled by a dedicated editor agent.

---

## The marketing problem

Independent coffee shops need a web presence but can't afford a strategist or an agency.
Generic AI site builders generate templated pages with **no marketing strategy** behind
them — no positioning, no audience targeting, no conversion goal. This project builds an AI
that makes the *marketing decisions* first, then renders them into a landing page.

## Why agents (not a single prompt)

Strategy and execution are different jobs. A single prompt that's asked to "write a landing
page" collapses both into one pass and quietly defaults to generic stock-cafe copy. Splitting
them into two graph nodes forces the strategic decisions (audience, positioning, tone,
conversion goal) to happen *before* — and independently of — the copy/design execution that
has to act on them.

## Architecture at a glance

```
Generation pipeline:
START
  → strategist     turns raw owner notes into marketing decisions (JSON)
  → generator      executes that strategy as a complete, styled HTML page,
                    using uploaded photos (if any) instead of placeholder
                    gradients
END

Editor loop (invoked once per revision from the UI):
START → editor → END     applies the owner's feedback (+ optional new
                          photos) to the existing page, in place
```

Built with **LangGraph** (`src/graph.py`): two `StateGraph`s over a typed `PipelineState` —
the generation pipeline streamed node-by-node so the Streamlit UI can show live per-step
progress, and a single-node editor graph invoked once per feedback round.

Photos never get sent to the LLM as raw pixel data: the generator/editor only ever see
`IMAGE_1`, `IMAGE_2`, ... placeholder tokens, and the real base64 photo gets swapped in only
at render time (`_inject_images`). This keeps the editor loop cheap even after several rounds
of feedback with new photos attached.

| Requirement | Where it's satisfied |
|---|---|
| Real business problem | Strategy-driven landing pages for small cafes that can't afford an agency |
| Backend / agent logic | `src/agents.py` (nodes), `src/graph.py` (graph assembly), `src/state.py` |
| Multi-agent, justified | Strategist (decisions) → Generator (execution) → Editor (revision) — kept separate so copy can't skip the strategy step, and revisions can't silently rewrite the whole page |
| State | Typed `PipelineState` (`shop`, `images`, `new_images`, `strategy`, `html_template`, `feedback`) threaded through both graphs |
| Real-time frontend↔backend integration | `frontend/app.py` streams the generation graph via `stream_mode="updates"` and updates an `st.status` box live; the editor loop runs synchronously per click |
| User input → real artifact | Photo uploads are resized, embedded as base64, and placed into the generated HTML in place of placeholder gradients; revision feedback (+ optional new photos) is applied directly to the existing page |

---

## Run it

```bash
pip install -r requirements.txt
streamlit run frontend/app.py
```

Copy `.env.example` to `.env` and add a free Gemini key
(aistudio.google.com/apikey): `GEMINI_API_KEY=your_key`. (When deployed on Streamlit
Community Cloud, set it instead via the app's Secrets panel.)

Fill in the coffee shop details, optionally upload a few photos, hit **Generate page**, and
you get two tabs: the live page and the strategy behind it. The page is downloadable as a
self-contained HTML file. Below the page preview, a feedback box (plus an optional photo
uploader) lets you hand notes to the editor agent — e.g. "add a section showcasing our
brownies" with a brownie photo attached — and it revises the existing page in place. Repeat
as many times as you like.

There's also a CLI runner for testing the graph without the UI:

```bash
python -m src.main --name "Ember & Oak" --location "Lavapiés, Madrid" \
  --differentiator "Single-origin, in-house roasted" \
  --vibe "Cozy, slow, lots of plants" --target "Remote workers and students"
```

## What to put in the report

1. **Problem** — small cafes need strategy-driven web presence, not templates.
2. **Framework** — frame as a *strategy → execution* AI pipeline. Connect to course content
   on GenAI in content creation and marketing automation.
3. **System** — the Strategist/Generator/Editor split, the LangGraph state, the photo pipeline.
4. **Demo / results** — screenshot the strategy tab + the rendered page. Run it on 3-4
   different cafes (with and without photos) to show it generalizes.
5. **Critical discussion** — where the strategy is generic vs. genuinely insightful,
   brand-safety, and why a human still validates before publishing.
6. **Conclusion** — what this says about GenAI lowering the cost of marketing strategy for
   small businesses.

## To make it more "yours"

- Run it on a few real local Madrid cafes and compare the strategies it produces.
- Tweak the Strategist prompt in `src/agents.py` to enforce a positioning framework you like.
- Try it with and without uploaded photos on the same shop to compare results.
