"use client";

import { useRef, useState } from "react";
import {
  BUSINESS_TYPES,
  BUSINESS_GOALS,
  type Shop,
  type Strategy,
} from "@/lib/types";

// --------------------------------------------------------------------------- //
// Helpers                                                                     //
// --------------------------------------------------------------------------- //

/** Downscale + recompress an uploaded image to a base64 JPEG data URI, so the
 *  request body stays small and the photo can be embedded directly in the
 *  generated single-file HTML. */
function fileToDataUri(file: File, maxDim = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function strategyToMarkdown(shop: Shop, s: Strategy): string {
  return [
    `# Strategy — ${shop.name}`,
    "",
    `**Business type:** ${shop.businessType}`,
    "",
    `**Positioning:** ${s.positioning}`,
    "",
    `**Target customer:** ${s.target_customer}`,
    "",
    `**Value proposition:** ${s.value_proposition}`,
    "",
    `**Tone:** ${s.tone}`,
    "",
    `**Conversion goal:** ${s.conversion_goal}`,
    "",
    "**Key messages:**",
    "",
    ...s.key_messages.map((m) => `- ${m}`),
    "",
  ].join("\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const MAX_PHOTOS = 5;

// --------------------------------------------------------------------------- //
// Page                                                                        //
// --------------------------------------------------------------------------- //
export default function Home() {
  const [shop, setShop] = useState<Shop>({
    businessType: BUSINESS_TYPES[0],
    name: "Ember & Oak",
    location: "A quiet corner in Lavapiés, Madrid",
    address: "",
    differentiator: "Single-origin beans roasted in-house; the only pour-over bar nearby",
    vibe: "Cozy, slow, lots of plants and warm wood",
    target: "Remote workers and students who care about good coffee",
    goal: BUSINESS_GOALS[0],
  });

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ strategy: Strategy; html: string; shop: Shop } | null>(null);
  const [tab, setTab] = useState<"page" | "strategy">("page");
  const fileInput = useRef<HTMLInputElement>(null);

  function set<K extends keyof Shop>(key: K, value: Shop[K]) {
    setShop((s) => ({ ...s, [key]: value }));
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS);
    setFiles(picked);
    setPreviews(picked.map((f) => URL.createObjectURL(f)));
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setSteps([]);
    setResult(null);

    try {
      const images = await Promise.all(files.map((f) => fileToDataUri(f)));

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, images }),
      });

      if (!res.ok || !res.body) {
        throw new Error((await res.text()) || `Request failed (${res.status})`);
      }

      // Parse the Server-Sent Events stream.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) handleFrame(frame);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function handleFrame(frame: string) {
    let event = "message";
    let data = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;
    const payload = JSON.parse(data);

    if (event === "progress") {
      setSteps((prev) => [...prev, payload.label as string]);
    } else if (event === "done") {
      setResult({ strategy: payload.strategy, html: payload.html, shop: { ...shop } });
      setTab("page");
    } else if (event === "error") {
      setError(payload.message as string);
    }
  }

  return (
    <main className="wrap">
      <div className="overline">Marketing strategy → landing page</div>
      <h1>PageForge</h1>
      <p className="subtitle">
        Makes the marketing decisions a strategist would — positioning, audience,
        value proposition — then renders them into a real landing page for any
        small or medium business.
      </p>

      {error && <div className="banner banner-error">{error}</div>}

      <hr className="rule" />

      <div className="card">
        <h2>Tell me about the business</h2>
        <div className="grid2">
          <div className="field">
            <label>Type of business</label>
            <select
              value={shop.businessType}
              onChange={(e) => set("businessType", e.target.value)}
            >
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Business name</label>
            <input
              type="text"
              value={shop.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Location / setting</label>
            <input
              type="text"
              value={shop.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Street address (optional, for the map link)</label>
            <input
              type="text"
              value={shop.address}
              placeholder="e.g. Calle de la Cabeza 12, 28012 Madrid"
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
          <div className="field">
            <label>What makes it different</label>
            <input
              type="text"
              value={shop.differentiator}
              onChange={(e) => set("differentiator", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Vibe / brand feel</label>
            <input
              type="text"
              value={shop.vibe}
              onChange={(e) => set("vibe", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Target customer (your guess)</label>
            <input
              type="text"
              value={shop.target}
              onChange={(e) => set("target", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Main goal of the page</label>
            <select value={shop.goal} onChange={(e) => set("goal", e.target.value)}>
              {BUSINESS_GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        {shop.goal === "Get people to visit in person" && !shop.address?.trim() && (
          <p className="field-help">
            No street address entered — the map button will guess the nearest
            match for the business name instead of pointing at a real place.
          </p>
        )}

        <div className="uploader">
          <label>
            Photos (optional — used as real photos instead of placeholder
            gradients; up to {MAX_PHOTOS})
          </label>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={onPickFiles}
          />
          {previews.length > 0 && (
            <div className="thumbs">
              {previews.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt={`upload ${i + 1}`} />
              ))}
            </div>
          )}
        </div>

        <div className="btn-row">
          <button className="btn" onClick={generate} disabled={busy || !shop.name.trim()}>
            {busy ? "Generating…" : "Generate page"}
          </button>
          {busy && <span className="field-help">Running the pipeline…</span>}
        </div>

        {steps.length > 0 && (
          <div className="status">
            {steps.map((s, i) => (
              <div className="status-line" key={i}>
                <span className="dot" />
                {s}
              </div>
            ))}
            {busy && (
              <div className="status-line">
                <span className="spinner" />
                Working…
              </div>
            )}
          </div>
        )}
      </div>

      {result && (
        <>
          <div className="tabs">
            <button
              className={`tab ${tab === "page" ? "active" : ""}`}
              onClick={() => setTab("page")}
            >
              Page
            </button>
            <button
              className={`tab ${tab === "strategy" ? "active" : ""}`}
              onClick={() => setTab("strategy")}
            >
              Strategy
            </button>
          </div>

          {tab === "page" && (
            <div>
              <iframe
                className="preview-frame"
                title="Generated landing page"
                srcDoc={result.html}
                sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
              />
              <div className="btn-row">
                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    download("landing_page.html", result.html, "text/html")
                  }
                >
                  Download page (HTML)
                </button>
              </div>
            </div>
          )}

          {tab === "strategy" && (
            <div className="card strategy">
              <h2>
                The marketing thinking
                <span className="tag">{result.shop.businessType}</span>
              </h2>
              <dl>
                <dt>Positioning</dt>
                <dd>{result.strategy.positioning}</dd>
                <dt>Target customer</dt>
                <dd>{result.strategy.target_customer}</dd>
                <dt>Value proposition</dt>
                <dd>{result.strategy.value_proposition}</dd>
                <dt>Tone</dt>
                <dd>{result.strategy.tone}</dd>
                <dt>Conversion goal</dt>
                <dd>{result.strategy.conversion_goal}</dd>
                <dt>Key messages</dt>
                <dd>
                  <ul>
                    {result.strategy.key_messages.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </dd>
              </dl>
              <div className="btn-row">
                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    download(
                      "strategy.md",
                      strategyToMarkdown(result.shop, result.strategy),
                      "text/markdown",
                    )
                  }
                >
                  Download strategy (.md)
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
