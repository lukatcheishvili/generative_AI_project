# AGENT.md — Operating Guide for AI Contributors

This file is the contract every AI assistant (and the human driving it) must follow when
working on this repository. Read it **before** making any change. It exists so that any
contributor — and their AI — can pick up the project, understand what happened, and know what
to do next without re-discovering context.

> Project: **Support-Triage Multi-Agent System** (LangGraph). See `README.md` for the product
> overview and `docs/architecture.md` for the technical deep dive.

---

## 1. Core rules (non-negotiable)

1. **Humans are the contributors, not the AI.** Never list an AI as a commit author,
   co-author, or PR author. No "Co-authored-by: Claude/GPT", no AI name in `git config`.
   Every commit and PR is authored under the **human contributor's own name and email**.
2. **Clarify before building.** If a task is vague, ask questions first and gather the
   maximum context possible (scope, inputs, expected output, edge cases, who it's for).
   Do not guess on ambiguous, high-impact decisions — confirm them.
3. **Refresh the docs every 8 prompts.** After every 8 user prompts in a working session,
   update this `AGENT.md` (the logs at the bottom) and the `README.md` so they reflect
   reality. Track the count in the **Changelog** below.
4. **Organize everything into folders.** No loose files in the repo root except the standard
   top-level ones (`README.md`, `AGENT.md`, `requirements.txt`, `.gitignore`, `.env.example`).
   Code lives in `src/`, tests in `tests/`, docs in `docs/`. New categories get their own
   folder (see §3).

## 2. Workflow rules (team, feature-branch + PR)

- **Branch per feature.** Never commit straight to `main`. Create `feature/<short-name>` (or
  `fix/<short-name>`, `docs/<short-name>`) and open a **Pull Request into `main`**.
- **PRs are authored by the human contributor** (rule 1). One PR = one logical change.
- **Conventional Commits** for messages and PR titles:
  `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`. Example:
  `feat(router): add confidence-based escalation branch`.
- **PR description** must state: what changed, why, how it was tested, and any new env vars.
- **Never force-push `main`.** Keep history readable; squash trivial commits in the PR.

## 3. Repository structure (keep it this way)

```
generative_AI_project/
├── README.md            # product overview + requirements
├── AGENT.md             # this file — rules + logs
├── requirements.txt
├── .env.example         # documents every env var (no secrets)
├── .gitignore           # .env and caches ignored
├── src/                 # all application/agent code
│   ├── config.py        # provider-agnostic LLM seam
│   ├── state.py         # typed graph state (memory)
│   ├── tools.py         # tool functions (mock backends)
│   ├── agents.py        # graph nodes (router, specialists, critic, ...)
│   ├── graph.py         # graph assembly (edges, interrupt, checkpointer)
│   └── main.py          # CLI runner
├── tests/               # pytest suite (mock mode, no network)
└── docs/                # architecture.md and future design notes
```

New kinds of artifacts get a dedicated folder, e.g. `scripts/` (utilities), `examples/`
(sample tickets/runs), `assets/` (diagrams, images), `presentation/` (slides). **Do not**
drop these in the root or inside `src/`.

## 4. Secrets & environment

- **Never commit `.env` or any key.** It is gitignored — keep it that way.
- Any new configuration must be added to **`.env.example`** with a placeholder value.
- Default to **`LLM_PROVIDER=mock`** so the repo runs offline with no key for tests/demos.
- If a secret is ever pasted into a chat or committed, treat it as compromised: rotate it and
  scrub it from history.

## 5. Testing gate

- **`pytest` must pass before any commit or PR.** Run from the repo root.
- **Every new node or tool ships with a test.** Tests run in `mock` mode — no network, no key.
- Don't mark work done while tests fail or coverage of new logic is missing.

## 6. Architecture rules

- **Justify every node, tool, and edge** in `docs/architecture.md`. If you can't explain why
  it exists, it shouldn't.
- **Keep nodes small and single-purpose** — one responsibility each.
- **Bound every loop** (e.g. `MAX_REVISIONS`) so the graph can never spin forever.
- **Go through the LLM seam** (`config.get_llm().complete(...)`); never hard-code a provider in
  a node. The graph must stay swappable across `openai | anthropic | mock`.
- **State is the memory.** Read/write `SupportState`; use reducers for fields that accumulate.

## 7. Useful skills & tooling for contributors

These help build the deliverables this project will need — reach for them when relevant:

- **Presentation deck (`pptx`)** — the graded output is a 20–30 min talk; generate/maintain the
  slide deck from `README.md` + `docs/architecture.md`.
- **Diagrams (Mermaid / diagram tools)** — render the graph (router → specialists → critic loop
  → human approval) as an image for the README and slides.
- **Written report (`docx` / `pdf`)** — if a written submission is required, export from the docs.
- **Web search** — verify business-case facts/figures for the "why it matters" section; cite sources.
- **LangSmith / tracing** — for debugging real-provider runs and showing the graph executing live.
- **CI (GitHub Actions)** — a workflow that runs `pytest` on every PR enforces the testing gate.
- **`xlsx`** — if you build a metrics/eval table (routing accuracy, latency) for the presentation.
- **web-design-guidelines** — only if an optional frontend is added; UI is not graded.

---

# 📋 ROADMAP — What should be done next

> Pending work, for the next contributor + their AI. Keep this list current; move items down
> to the Changelog when finished.

- [ ] **Add an architecture diagram** (Mermaid or PNG) to `README.md` and `docs/`.
- [ ] **Build the presentation deck** (`presentation/`) covering: business problem, why it
      matters, the agent system, technical implementation, end-to-end flow.
- [ ] **Decide final business framing.** Current build = support triage. Higher-impact
      re-skins discussed: **AML alert-triage** or **revenue-leakage / billing reconciliation**
      (same graph, swap tools + domain prompts). Confirm with the team before re-skinning.
- [ ] **Add a CI workflow** (`.github/workflows/`) running `pytest` on every PR.
- [ ] **Add `examples/`** with sample tickets + recorded runs for the demo.
- [ ] **Swap `MemorySaver` for a persistent checkpointer** (SQLite) so threads survive restarts.
- [ ] **Add a real-provider smoke test** (skipped unless an API key is present).
- [ ] **Guardrails on money-moving tools** (e.g. refund caps, fraud checks) for the approval gate.

---

# ✅ CHANGELOG — What we have done

> Newest at the top. Each entry: date · prompt range · summary. Refresh per rule 3 (every 8 prompts).

**Prompt-counter:** 6 / 8 — next mandatory `AGENT.md` + `README.md` refresh due at prompt 8.

- **2026-06-25 · prompts 1–5 · Initial system + docs**
  - Scaffolded `generative_AI_project` with `src/`, `tests/`, `docs/`, `.gitignore`,
    `.env`/`.env.example`, `requirements.txt`.
  - Built the LangGraph **support-triage multi-agent system**: provider-agnostic LLM layer
    (`openai | anthropic | mock`), typed `SupportState` + `MemorySaver`, mock tools, router +
    4 specialists, bounded critic/revise refinement loop, human-in-the-loop via
    `interrupt_before`, CLI runner.
  - Wrote `README.md` and `docs/architecture.md` (presentation-ready justification).
  - **12 passing tests** (mock mode); verified end-to-end demo run.
  - Initialized git and **pushed to** `github.com/lukatcheishvili/generative_AI_project`
    (commit `3e93466`). `.env` confirmed gitignored.
  - Added **Project Requirements** section + compliance table to `README.md` (commit `7d99235`).
  - ⚠️ Open action for the human: rotate the GitHub token (shared in plaintext) and delete the
    broken `.git` left in the local Windows folder (build/push were done from a clean copy).
- **2026-06-25 · prompt 6 · Added `AGENT.md`** with operating rules, workflow, structure,
  skills, roadmap, and this changelog.
