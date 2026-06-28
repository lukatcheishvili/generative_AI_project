/**
 * POST /api/generate  — Plan Mode, step 2.
 *
 * Takes the APPROVED plan (possibly edited by the user) plus any photos and
 * runs the Generator, streaming back the finished landing-page HTML.
 *
 * Body: { plan: Plan, images?: string[], model?: string }
 * SSE events:
 *   progress  { label }
 *   done      { html }
 *   error     { message }
 */

import { runGenerator } from "@/lib/agents";
import type { Credentials } from "@/lib/llm";
import { BUILD_STEP, type Plan } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Generating a full HTML page can take well over a minute, so give the function
// the maximum room the plan allows. The old 60s cap was killing the Generator
// mid-call, which left the client stuck on "Working…".
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: { plan?: unknown; images?: unknown; model?: unknown; credentials?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const plan = body.plan as Plan | undefined;
  const images = Array.isArray(body.images) ? (body.images as string[]) : [];
  const model = typeof body.model === "string" ? body.model : undefined;
  const credentials = (body.credentials as Credentials | undefined) || undefined;

  if (!plan || !plan.business || !plan.strategy) {
    return new Response("Missing or malformed field: plan", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      try {
        send("progress", { label: BUILD_STEP });
        const html = await runGenerator(plan, images, model, credentials);
        send("done", { html });
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
