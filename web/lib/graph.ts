/**
 * The pipeline as a LangGraph.js graph: strategist -> generator.
 *
 * In the web app the two agents are invoked as SEPARATE requests (/api/plan
 * then /api/build) so a human can approve the plan in between — the
 * "interrupt before you act" gate from the original design. This graph is the
 * canonical, non-interactive view of the same pipeline (used for tests / a
 * future one-shot path) and keeps the multi-agent structure documented in code.
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

import { runStrategist, runGenerator } from "./agents";
import type { Plan } from "./types";

export const PipelineState = Annotation.Root({
  brief: Annotation<string>(),
  model: Annotation<string | undefined>(),
  images: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  plan: Annotation<Plan | undefined>(),
  html: Annotation<string | undefined>(),
});

async function strategistNode(state: typeof PipelineState.State) {
  const plan = await runStrategist(state.brief, state.model);
  return { plan };
}

async function generatorNode(state: typeof PipelineState.State) {
  const html = await runGenerator(state.plan!, state.images || [], state.model);
  return { html };
}

function buildGraph() {
  return new StateGraph(PipelineState)
    .addNode("strategist", strategistNode)
    .addNode("generator", generatorNode)
    .addEdge(START, "strategist")
    .addEdge("strategist", "generator")
    .addEdge("generator", END)
    .compile();
}

let _graph: ReturnType<typeof buildGraph> | null = null;

export function getGraph() {
  if (!_graph) _graph = buildGraph();
  return _graph;
}
