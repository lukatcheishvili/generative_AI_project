/**
 * Provider seam.
 *
 * Every node calls the model through one function: `callModel(prompt, temperature)`.
 * Swapping LLM_PROVIDER between "gemini" and "vertex" changes the model — never the graph.
 *
 *   - "gemini" -> Gemini Developer API, authenticated with GEMINI_API_KEY.
 *   - "vertex" -> Vertex AI on Google Cloud, authenticated with a service account
 *                 (or Application Default Credentials locally).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { VertexAI } from "@google-cloud/vertexai";

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export function activeProvider(): "gemini" | "vertex" {
  return (process.env.LLM_PROVIDER || "gemini").trim().toLowerCase() === "vertex"
    ? "vertex"
    : "gemini";
}

export async function callModel(
  prompt: string,
  temperature = 0.7,
  model?: string,
): Promise<string> {
  const modelName = model || MODEL_NAME;
  return activeProvider() === "vertex"
    ? callVertex(prompt, temperature, modelName)
    : callGemini(prompt, temperature, modelName);
}

// --------------------------------------------------------------------------- //
// Gemini Developer API                                                        //
// --------------------------------------------------------------------------- //
async function callGemini(
  prompt: string,
  temperature: number,
  modelName: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set (required when LLM_PROVIDER=gemini).");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// --------------------------------------------------------------------------- //
// Vertex AI                                                                   //
// --------------------------------------------------------------------------- //
async function callVertex(
  prompt: string,
  temperature: number,
  modelName: string,
): Promise<string> {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  if (!project) {
    throw new Error("GOOGLE_CLOUD_PROJECT is not set (required when LLM_PROVIDER=vertex).");
  }

  const credentials = serviceAccountCredentials();
  const vertex = new VertexAI({
    project,
    location,
    // If credentials are omitted, the SDK falls back to Application Default
    // Credentials (e.g. `gcloud auth application-default login` locally).
    googleAuthOptions: credentials ? { credentials } : undefined,
  });

  const model = vertex.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature },
  });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  const parts = result.response.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("");
  if (!text) throw new Error("Vertex AI returned an empty response.");
  return text;
}

/**
 * Read service-account credentials for Vertex from GOOGLE_SERVICE_ACCOUNT_JSON.
 * Accepts either raw JSON or a base64 encoding of it (base64 is easier to paste
 * into a Vercel env var). Returns undefined to fall back to ADC.
 */
function serviceAccountCredentials(): Record<string, unknown> | undefined {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return undefined;

  // Tolerate a value that was pasted wrapped in quotes.
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1).trim();
  }

  // Raw JSON starts with "{"; otherwise treat it as base64 and strip any
  // whitespace/newlines a dashboard may have inserted into the long string.
  const jsonStr = raw.startsWith("{")
    ? raw
    : Buffer.from(raw.replace(/\s+/g, ""), "base64").toString("utf8");

  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is set but did not decode to valid JSON. " +
        "Re-copy the full base64 string and paste it without truncation.",
    );
  }
}
