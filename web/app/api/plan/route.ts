/**
 * POST /api/plan  — Plan Mode, step 1.
 *
 * Runs the Strategist on the user's free-form brief and streams back a Plan
 * (extracted business basics + marketing strategy) for the human to approve.
 * Nothing is generated yet.
 *
 * Body: { brief: string, model?: string }
 * SSE events:
 *   progress  { label }
 *   done      { plan }
 *   error     { message }
 */

import { runStrategist } from "@/lib/agents";
import { PLAN_STEP } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { brief?: unknown; model?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  const model = typeof body.model === "string" ? body.model : undefined;
  if (!brief) {
    return new Response("Missing required field: brief", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      try {
        send("progress", { label: PLAN_STEP });
        const plan = await runStrategist(brief, model);
        send("done", { plan });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Planning failed unexpectedly.";
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
