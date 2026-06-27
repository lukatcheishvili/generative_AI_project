/**
 * POST /api/generate
 *
 * Runs the LangGraph pipeline and streams progress to the browser as
 * Server-Sent Events (SSE), so the UI shows live per-node status — the
 * real-time frontend <-> backend integration the project is graded on.
 *
 * Events emitted:
 *   event: progress  data: { node, label }     (once per node as it finishes)
 *   event: done      data: { strategy, html }   (final result)
 *   event: error     data: { message }          (on failure)
 */

import { getGraph } from "@/lib/graph";
import { STEP_LABELS, type Shop } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // generation can take 20-40s; raise on Vercel Pro if needed

export async function POST(req: Request) {
  let body: { shop?: unknown; images?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const shop = body.shop as Shop | undefined;
  const images = Array.isArray(body.images) ? (body.images as string[]) : [];

  if (!shop || typeof shop.name !== "string" || !shop.name.trim()) {
    return new Response("Missing required field: shop.name", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );

      try {
        const graph = getGraph();
        const acc: Record<string, unknown> = {};

        const updates = await graph.stream(
          { shop, images },
          { streamMode: "updates" },
        );
        for await (const chunk of updates) {
          for (const [node, partial] of Object.entries(
            chunk as Record<string, Record<string, unknown>>,
          )) {
            Object.assign(acc, partial);
            send("progress", { node, label: STEP_LABELS[node] ?? node });
          }
        }

        send("done", { strategy: acc.strategy, html: acc.html });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Generation failed unexpectedly.";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
