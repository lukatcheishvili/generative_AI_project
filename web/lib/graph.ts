/**
 * The pipeline, expressed as a LangGraph.js graph.
 *
 * Two nodes, run in a straight line:
 *   strategist -> generator
 *
 * Splitting strategy from execution is the whole point: a single "write me a
 * landing page" prompt collapses both and defaults to generic copy. Forcing the
 * strategic decisions to happen first, in their own node, is what makes this a
 * justified multi-agent graph rather than one big prompt.
 *
 * The compiled graph is streamed node-by-node (streamMode "updates") so the UI
 * can report live per-step progress.
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

import { runStrategist, runGenerator } from "./agents";
import type { Shop, Strategy } from "./types";

export const PipelineState = Annotation.Root({
  shop: Annotation<Shop>(),
  images: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  strategy: Annotation<Strategy | undefined>(),
  html: Annotation<string | undefined>(),
});

async function strategistNode(state: typeof PipelineState.State) {
  const strategy = await runStrategist(state.shop);
  return { strategy };
}

async function generatorNode(state: typeof PipelineState.State) {
  const html = await runGenerator(state.shop, state.strategy!, state.images || []);
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
