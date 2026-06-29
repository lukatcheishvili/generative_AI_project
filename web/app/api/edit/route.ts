/**
 * POST /api/edit  — refine an already-generated page.
 *
 * Takes the current landing-page HTML plus a natural-language instruction and
 * runs the Editor, streaming back the updated HTML. Used for the in-chat
 * "keep refining this page" loop (e.g. "use purple instead of black").
 *
 * Body: { html: string, instruction: string, strategy?: Strategy, model?: string }
 * SSE events:
 *   progress  { label }
 *   done      { html }
 *   error     { message }
 */

import { runEditor } from "@/lib/agents";
import type { Credentials } from "@/lib/llm";
import { EDIT_STEP, type Strategy } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Editing regenerates the full page, which can take a while — match /api/generate.
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: {
    html?: unknown;
    instruction?: unknown;
    strategy?: unknown;
    model?: unknown;
    credentials?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const html = typeof body.html === "string" ? body.html : "";
  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  const strategy = (body.strategy as Strategy | undefined) || undefined;
  const model = typeof body.model === "string" ? body.model : undefined;
  const credentials = (body.credentials as Credentials | undefined) || undefined;

  if (!html || !instruction) {
    return new Response("Missing required field: html and instruction", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      try {
        send("progress", { label: EDIT_STEP });
        const updated = await runEditor(html, instruction, strategy, model, credentials);
        send("done", { html: updated });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Editing failed unexpectedly.";
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
