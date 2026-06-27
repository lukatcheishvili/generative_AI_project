"use client";

import { useEffect, useRef, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import {
  MODELS,
  DEFAULT_MODEL,
  BUSINESS_GOALS,
  type Plan,
  type Shop,
  type Strategy,
} from "@/lib/types";

type Phase = "idle" | "planning" | "plan" | "building" | "done";

/** One stored session shown in the sidebar. */
interface Conversation {
  id: string;
  title: string;
  brief: string;
  plan: Plan | null;
  html: string | null;
  model: string;
  createdAt: number;
}

const MAX_PHOTOS = 5;
const STORAGE_KEY = "pageforge.conversations";
const SIDEBAR_KEY = "pageforge.sidebar";

const SUGGESTIONS = [
  "A cozy specialty coffee shop in Lisbon focused on single-origin pour-overs for remote workers.",
  "A boutique pilates studio in Madrid for busy professionals — premium, calm, results-driven.",
  "A family-run Italian trattoria in Brooklyn that wants more weeknight dinner reservations.",
];

// --------------------------------------------------------------------------- //
// Helpers                                                                     //
// --------------------------------------------------------------------------- //
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function titleFrom(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 42 ? t.slice(0, 40) + "…" : t || "Untitled";
}

/** Persist conversations, trimming oldest if we hit the localStorage quota. */
function safeStore(list: Conversation[]): Conversation[] {
  let trimmed = list.slice(0, 20);
  for (let i = 0; i < 6; i++) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return trimmed;
    } catch {
      trimmed = trimmed.slice(0, Math.max(1, trimmed.length - 1));
    }
  }
  return trimmed;
}

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

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Open the generated page full-size in a new browser tab. */
function openFullPage(htmlStr: string) {
  const blob = new Blob([htmlStr], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function strategyToMarkdown(plan: Plan): string {
  const { business: b, strategy: s } = plan;
  return [
    `# Strategy — ${b.name}`,
    "",
    `**Business:** ${b.businessType} · ${b.location}`,
    `**Goal:** ${b.goal}`,
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

type SSEHandler = (event: string, payload: any) => void;

async function streamSSE(url: string, body: unknown, onEvent: SSEHandler) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new Error((await res.text()) || `Request failed (${res.status})`);
  }
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
    for (const frame of frames) {
      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) onEvent(event, JSON.parse(data));
    }
  }
}

// --------------------------------------------------------------------------- //
// Page                                                                        //
// --------------------------------------------------------------------------- //
export default function Home() {
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [brief, setBrief] = useState("");
  const [submittedBrief, setSubmittedBrief] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resultTab, setResultTab] = useState<"page" | "strategy">("page");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const voiceBaseRef = useRef("");

  // Load history + sidebar preference on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setConversations(JSON.parse(raw) as Conversation[]);
      const sb = localStorage.getItem(SIDEBAR_KEY);
      if (sb !== null) setSidebarOpen(sb === "1");
    } catch {
      /* ignore */
    }
  }, []);

  // Detect Web Speech API support (Chrome/Edge/Safari).
  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVoiceSupported(Boolean(SR));
  }, []);

  // Keep photo previews in sync with the selected files (and revoke old URLs).
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const busy = phase === "planning" || phase === "building";
  const canSubmit = brief.trim().length > 0 && (phase === "idle" || phase === "done");
  const enoughPhotos = files.length >= 3;

  function updateBusiness<K extends keyof Shop>(key: K, value: Shop[K]) {
    setPlan((p) => (p ? { ...p, business: { ...p.business, [key]: value } } : p));
  }
  function updateStrategy<K extends keyof Strategy>(key: K, value: Strategy[K]) {
    setPlan((p) => (p ? { ...p, strategy: { ...p.strategy, [key]: value } } : p));
  }

  function upsertConversation(conv: Conversation) {
    setConversations((prev) =>
      safeStore([conv, ...prev.filter((c) => c.id !== conv.id)]),
    );
  }

  function toggleSidebar() {
    setSidebarOpen((o) => {
      const n = !o;
      try {
        localStorage.setItem(SIDEBAR_KEY, n ? "1" : "0");
      } catch {
        /* ignore */
      }
      return n;
    });
  }

  function newChat() {
    setCurrentId(null);
    setSubmittedBrief("");
    setBrief("");
    setPlan(null);
    setHtml(null);
    setSteps([]);
    setError(null);
    setFiles([]);
    setPhase("idle");
  }

  function loadConversation(c: Conversation) {
    setCurrentId(c.id);
    setSubmittedBrief(c.brief);
    setBrief("");
    setPlan(c.plan);
    setHtml(c.html);
    setModel(c.model);
    setSteps([]);
    setError(null);
    setFiles([]);
    setResultTab("page");
    setPhase(c.html ? "done" : c.plan ? "plan" : "idle");
  }

  function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setConversations((prev) => safeStore(prev.filter((c) => c.id !== id)));
    if (currentId === id) newChat();
  }

  function addFiles(incoming: File[]) {
    const imgs = incoming.filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) return;
    setFiles((prev) => [...prev, ...imgs].slice(0, MAX_PHOTOS));
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = ""; // allow re-picking the same file
  }

  function onDropFiles(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files ?? []));
  }

  function removePhoto(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function startVoice() {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    voiceBaseRef.current = brief ? brief.trimEnd() + " " : "";
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setBrief(voiceBaseRef.current + text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function stopVoice() {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }

  function toggleVoice() {
    if (listening) stopVoice();
    else startVoice();
  }

  async function submitBrief() {
    const text = brief.trim();
    if (!text) return;
    if (listening) stopVoice();
    const id = uid();
    setCurrentId(id);
    setSubmittedBrief(text);
    setBrief("");
    setPlan(null);
    setHtml(null);
    setError(null);
    setSteps([]);
    setPhase("planning");
    try {
      await streamSSE("/api/plan", { brief: text, model }, (event, payload) => {
        if (event === "progress") setSteps((s) => [...s, payload.label]);
        else if (event === "done") {
          const newPlan = payload.plan as Plan;
          setPlan(newPlan);
          setPhase("plan");
          upsertConversation({
            id,
            title: titleFrom(text),
            brief: text,
            plan: newPlan,
            html: null,
            model,
            createdAt: Date.now(),
          });
        } else if (event === "error") {
          setError(payload.message as string);
          setPhase("idle");
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  async function confirmBuild() {
    if (!plan) return;
    setError(null);
    setSteps([]);
    setPhase("building");
    try {
      const images = await Promise.all(files.map((f) => fileToDataUri(f)));
      const cleaned: Plan = {
        ...plan,
        strategy: {
          ...plan.strategy,
          key_messages: plan.strategy.key_messages.map((m) => m.trim()).filter(Boolean),
        },
      };
      await streamSSE("/api/generate", { plan: cleaned, images, model }, (event, payload) => {
        if (event === "progress") setSteps((s) => [...s, payload.label]);
        else if (event === "done") {
          const builtHtml = payload.html as string;
          setHtml(builtHtml);
          setResultTab("page");
          setPhase("done");
          if (currentId) {
            upsertConversation({
              id: currentId,
              title: titleFrom(submittedBrief),
              brief: submittedBrief,
              plan: cleaned,
              html: builtHtml,
              model,
              createdAt: Date.now(),
            });
          }
        } else if (event === "error") {
          setError(payload.message as string);
          setPhase("plan");
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("plan");
    }
  }

  function editBrief() {
    setBrief(submittedBrief);
    setPlan(null);
    setHtml(null);
    setSteps([]);
    setError(null);
    setPhase("idle");
    textareaRef.current?.focus();
  }

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) submitBrief();
    }
  }

  const showGreeting = phase === "idle" && !submittedBrief;

  return (
    <div className="shell">
      {/* Sidebar — conversation history */}
      <aside className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <div className="sidebar-inner">
          <div className="sidebar-head">
            <button className="newchat-btn" onClick={newChat}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New chat
            </button>
          </div>
          <div className="conv-list">
            {conversations.length === 0 ? (
              <div className="conv-empty">Your generated pages will appear here.</div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={`conv-item ${c.id === currentId ? "active" : ""}`}
                  onClick={() => loadConversation(c)}
                  title={c.brief}
                >
                  <span className="conv-title">{c.title}</span>
                  <button
                    className="conv-del"
                    onClick={(e) => deleteConversation(c.id, e)}
                    aria-label="Delete conversation"
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <button
              className="sidebar-toggle"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="brand-dot" />
            PageForge
          </div>
          <div className="topbar-right">
            <ThemeToggle />
          </div>
        </header>

        <main className="canvas">
          <div className="canvas-inner">
            {showGreeting && (
              <div className="greeting">
                <h1>What are we building?</h1>
                <p>
                  Describe your business in a sentence or two. I&apos;ll plan the
                  marketing strategy first — you approve it, then I build the page.
                </p>
                <div className="suggestions">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      className="chip"
                      onClick={() => {
                        setBrief(s);
                        textareaRef.current?.focus();
                      }}
                    >
                      {s.length > 48 ? s.slice(0, 46) + "…" : s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {submittedBrief && <div className="user-brief">{submittedBrief}</div>}

            {error && <div className="banner banner-error">{error}</div>}

            {/* Plan card (Plan Mode) */}
            {plan && (phase === "plan" || phase === "building") && (
              <div className="card">
                <div className="overline">Plan Mode · review &amp; approve</div>
                <h2>Here&apos;s the plan</h2>
                <p style={{ color: "var(--ink-muted)", margin: "4px 0 0" }}>
                  I extracted the basics and made the marketing decisions. Edit
                  anything, then approve to build the page.
                </p>

                <div className="plan-grid">
                  <div className="field">
                    <label>Business name</label>
                    <input
                      type="text"
                      value={plan.business.name}
                      disabled={phase === "building"}
                      onChange={(e) => updateBusiness("name", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Type of business</label>
                    <input
                      type="text"
                      value={plan.business.businessType}
                      disabled={phase === "building"}
                      onChange={(e) => updateBusiness("businessType", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Location</label>
                    <input
                      type="text"
                      value={plan.business.location}
                      disabled={phase === "building"}
                      onChange={(e) => updateBusiness("location", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Street address (optional, for the map link)</label>
                    <input
                      type="text"
                      value={plan.business.address ?? ""}
                      disabled={phase === "building"}
                      onChange={(e) => updateBusiness("address", e.target.value)}
                    />
                  </div>
                  <div className="field full">
                    <label>Goal of the page</label>
                    <select
                      className="field-input"
                      value={plan.business.goal}
                      disabled={phase === "building"}
                      onChange={(e) => updateBusiness("goal", e.target.value)}
                    >
                      {BUSINESS_GOALS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field full">
                    <label>Positioning</label>
                    <input
                      type="text"
                      value={plan.strategy.positioning}
                      disabled={phase === "building"}
                      onChange={(e) => updateStrategy("positioning", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Target customer</label>
                    <input
                      type="text"
                      value={plan.strategy.target_customer}
                      disabled={phase === "building"}
                      onChange={(e) => updateStrategy("target_customer", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Tone</label>
                    <input
                      type="text"
                      value={plan.strategy.tone}
                      disabled={phase === "building"}
                      onChange={(e) => updateStrategy("tone", e.target.value)}
                    />
                  </div>
                  <div className="field full">
                    <label>Value proposition</label>
                    <input
                      type="text"
                      value={plan.strategy.value_proposition}
                      disabled={phase === "building"}
                      onChange={(e) => updateStrategy("value_proposition", e.target.value)}
                    />
                  </div>
                  <div className="field full">
                    <label>Key messages (one per line)</label>
                    <textarea
                      className="field-input"
                      rows={3}
                      value={plan.strategy.key_messages.join("\n")}
                      disabled={phase === "building"}
                      onChange={(e) =>
                        updateStrategy("key_messages", e.target.value.split("\n"))
                      }
                    />
                  </div>
                  <div className="field full">
                    <label>
                      Photos — used as the real images on your page (add at least 3)
                    </label>
                    <div
                      className={`dropzone ${dragOver ? "drag" : ""}`}
                      onClick={() => fileInput.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={onDropFiles}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5-5 5 5M12 5v12" />
                      </svg>
                      <span>
                        Click to upload or drag &amp; drop — JPG/PNG/WebP, up to {MAX_PHOTOS}
                      </span>
                    </div>
                    {previews.length > 0 && (
                      <div className="thumbs">
                        {previews.map((src, i) => (
                          <div className="thumb" key={i}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={`photo ${i + 1}`} />
                            <button
                              className="thumb-del"
                              onClick={() => removePhoto(i)}
                              disabled={phase === "building"}
                              aria-label="Remove photo"
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {phase === "plan" && (
                  <>
                    {!enoughPhotos && (
                      <div className="banner banner-info">
                        Please add at least 3 photos above — I&apos;ll place them as the
                        real images on your page. You&apos;ve added {files.length}.
                      </div>
                    )}
                    <div className="actions">
                      <button
                        className="btn btn-primary"
                        onClick={confirmBuild}
                        disabled={!enoughPhotos}
                      >
                        Confirm &amp; build page
                      </button>
                      <button className="btn btn-secondary" onClick={editBrief}>
                        Edit brief
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Progress */}
            {busy && (
              <div className="status">
                {steps.map((s, i) => (
                  <div className="status-line" key={i}>
                    <span className="dot" />
                    {s}
                  </div>
                ))}
                <div className="status-line">
                  <span className="spinner" />
                  Working…
                </div>
              </div>
            )}

            {/* Result */}
            {phase === "done" && html && plan && (
              <div className="card">
                <div className="tabs">
                  <button
                    className={`tab ${resultTab === "page" ? "active" : ""}`}
                    onClick={() => setResultTab("page")}
                  >
                    Page
                  </button>
                  <button
                    className={`tab ${resultTab === "strategy" ? "active" : ""}`}
                    onClick={() => setResultTab("strategy")}
                  >
                    Strategy
                  </button>
                </div>

                {resultTab === "page" ? (
                  <>
                    <div className="preview-wrap">
                      <iframe
                        className="preview-frame"
                        title="Generated landing page"
                        srcDoc={html}
                        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                      />
                      <button
                        className="preview-expand"
                        onClick={() => openFullPage(html)}
                        title="Open full size in a new tab"
                        aria-label="Open full size"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                        </svg>
                      </button>
                    </div>
                    <div className="actions">
                      <button
                        className="btn btn-primary"
                        onClick={() => download("landing_page.html", html, "text/html")}
                      >
                        Download HTML
                      </button>
                      <button className="btn btn-secondary" onClick={() => openFullPage(html)}>
                        Open full size
                      </button>
                      <button className="btn btn-secondary" onClick={confirmBuild}>
                        Regenerate
                      </button>
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="strategy">
                      <p><strong>Positioning</strong> — {plan.strategy.positioning}</p>
                      <p><strong>Target customer</strong> — {plan.strategy.target_customer}</p>
                      <p><strong>Value proposition</strong> — {plan.strategy.value_proposition}</p>
                      <p><strong>Tone</strong> — {plan.strategy.tone}</p>
                      <p><strong>Conversion goal</strong> — {plan.strategy.conversion_goal}</p>
                    </div>
                    <strong>Key messages</strong>
                    <ul className="key-messages">
                      {plan.strategy.key_messages.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                    <div className="actions">
                      <button
                        className="btn btn-secondary"
                        onClick={() =>
                          download("strategy.md", strategyToMarkdown(plan), "text/markdown")
                        }
                      >
                        Download strategy (.md)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Composer */}
        <div className="composer-wrap">
          <div style={{ width: "100%", maxWidth: 760 }}>
            {previews.length > 0 && phase === "idle" && (
              <div className="thumbs">
                {previews.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt={`photo ${i + 1}`} />
                ))}
              </div>
            )}
            <div className="composer">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={onPickFiles}
              />
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder={
                  phase === "done"
                    ? "Describe another business to build a new page…"
                    : "Describe your business and what you want…"
                }
                value={brief}
                disabled={busy || phase === "plan"}
                onChange={(e) => setBrief(e.target.value)}
                onKeyDown={onComposerKeyDown}
              />
              <div className="composer-controls">
                <div className="composer-controls-left">
                  <button
                    className="icon-btn"
                    title="Attach photos"
                    onClick={() => fileInput.current?.click()}
                    disabled={busy}
                    aria-label="Attach photos"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                  <button
                    className={`icon-btn ${listening ? "listening" : ""}`}
                    title={
                      !voiceSupported
                        ? "Voice input isn't supported in this browser"
                        : listening
                          ? "Stop voice input"
                          : "Voice input"
                    }
                    onClick={toggleVoice}
                    disabled={busy || !voiceSupported}
                    aria-label="Voice input"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="2" width="6" height="11" rx="3" />
                      <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
                    </svg>
                  </button>
                  <div className="model-select">
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      aria-label="Model"
                    >
                      {MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  className="send-btn"
                  onClick={submitBrief}
                  disabled={!canSubmit}
                  aria-label="Send"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="composer-hint">
              {phase === "plan"
                ? "Review the plan above, then approve to build."
                : "PageForge plans the strategy first, then builds on your approval."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
