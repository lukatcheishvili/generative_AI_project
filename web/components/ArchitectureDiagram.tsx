"use client";

import { useState } from "react";

/**
 * Faithful SVG recreation of the PageForge architecture flow (matches the Figma
 * board), with hover popovers explaining each box for non-technical viewers.
 */

type BoxDef = {
  x: number; y: number; w: number; h: number;
  title: string; sub: string; fill: string; stroke: string;
};

const cli = { fill: "#10243f", stroke: "#3b82c4" };
const ver = { fill: "#1b2230", stroke: "#647389" };
const agt = { fill: "#211a3a", stroke: "#7c5cff" };
const prv = { fill: "#2a2208", stroke: "#d4940f" };
const llm = { fill: "#0e2417", stroke: "#36a35b" };

const LAYERS = [
  { x: 0, y: 0, w: 1100, h: 180, label: "CLIENT · BROWSER", color: "#2f6fb0" },
  { x: 0, y: 270, w: 1100, h: 250, label: "VERCEL · NEXT.JS (APP ROUTER)", color: "#475569" },
  { x: 0, y: 600, w: 1100, h: 200, label: "AGENTS · LANGGRAPH PIPELINE", color: "#6b54c9" },
  { x: 0, y: 880, w: 1100, h: 150, label: "PROVIDER SEAM · lib/llm.ts", color: "#b07d12" },
  { x: 0, y: 1110, w: 1100, h: 260, label: "LLM · GOOGLE", color: "#2f8f55" },
];

const BOXES: Record<string, BoxDef> = {
  chat:   { x: 70,  y: 50,   w: 300, h: 92,  title: "Chat UI",              sub: "composer · plan card · preview", ...cli },
  hist:   { x: 400, y: 50,   w: 300, h: 92,  title: "History & Settings",   sub: "stored in localStorage",          ...cli },
  photo:  { x: 730, y: 50,   w: 300, h: 92,  title: "Photo upload",         sub: "resized to base64",               ...cli },
  front:  { x: 400, y: 320,  w: 300, h: 82,  title: "Frontend",             sub: "page.tsx · SSR + UI",             ...ver },
  plan:   { x: 70,  y: 430,  w: 300, h: 82,  title: "/api/plan",            sub: "Strategist route · SSE",          ...ver },
  gen:    { x: 730, y: 430,  w: 300, h: 82,  title: "/api/generate",        sub: "Generator route · SSE",           ...ver },
  strat:  { x: 70,  y: 650,  w: 300, h: 100, title: "Strategist",           sub: "brief to marketing plan",         ...agt },
  appr:   { x: 400, y: 650,  w: 300, h: 100, title: "Human approval",       sub: "edit & confirm the plan",         ...agt },
  gener:  { x: 730, y: 650,  w: 300, h: 100, title: "Generator",            sub: "plan + photos to HTML",           ...agt },
  seam:   { x: 400, y: 925,  w: 300, h: 82,  title: "Provider seam",        sub: "gemini | vertex · per-request creds", ...prv },
  gemapi: { x: 150, y: 1160, w: 300, h: 82,  title: "Gemini API",           sub: "API key",                         ...llm },
  vertex: { x: 650, y: 1160, w: 300, h: 82,  title: "Vertex AI",            sub: "service account · region",        ...llm },
  flash:  { x: 400, y: 1260, w: 300, h: 82,  title: "Google Gemini Models", sub: "Strategist 0.6 · Generator 0.8",  ...llm },
};

type Insight = { why: string; what: string; input: string; output: string };
const INSIGHTS: Record<string, Insight> = {
  chat: {
    why: "It's the only thing a non-technical user touches — the whole product is driven from here.",
    what: "Lets you describe your business, review the plan, watch progress, and preview or download the page.",
    input: "Your typed (or spoken) brief, edits to the plan, and clicks.",
    output: "Requests to the backend; shows the strategy and the finished page.",
  },
  hist: {
    why: "So your past pages and your own keys persist between visits — no login needed.",
    what: "Saves each generated page and your credential settings in the browser.",
    input: "Conversations you create; credentials you enter in Settings.",
    output: "Reloads a past page; supplies credentials to each request.",
  },
  photo: {
    why: "Real photos make the page look like a real brand, not a stock template.",
    what: "Lets you attach your own images, which are shrunk and embedded into the page.",
    input: "Image files you upload.",
    output: "Compact base64 images placed into the landing page.",
  },
  front: {
    why: "The web app users load — it renders the interface and talks to the backend.",
    what: "A Next.js page that serves the UI and streams results live.",
    input: "User actions from the Chat UI.",
    output: "Calls to /api/plan and /api/generate; live updates back to the screen.",
  },
  plan: {
    why: "Keeps the 'thinking' step on the server, where the AI keys live safely.",
    what: "A serverless endpoint that runs the Strategist and streams its progress.",
    input: "Your business brief, the chosen model and credentials.",
    output: "A structured marketing plan, streamed back.",
  },
  gen: {
    why: "Separates building the page from planning it, so each step is simple and safe.",
    what: "A serverless endpoint that runs the Generator and streams the result.",
    input: "The approved plan and your photos.",
    output: "A complete HTML landing page, streamed back.",
  },
  strat: {
    why: "Most AI page builders skip strategy and produce generic copy — this fixes that.",
    what: "An AI agent that decides positioning, audience, tone and key messages first.",
    input: "Your free-text business description.",
    output: "A structured marketing plan for you to review.",
  },
  appr: {
    why: "A human checks the plan before anything is built — prevents wasted or wrong output.",
    what: "A review step where you can edit the plan and confirm it.",
    input: "The Strategist's proposed plan.",
    output: "An approved (possibly edited) plan.",
  },
  gener: {
    why: "Turns the approved strategy into something real and usable.",
    what: "An AI agent that writes a full, styled, single-file web page.",
    input: "The approved plan and your photos.",
    output: "A downloadable HTML landing page.",
  },
  seam: {
    why: "Lets the app run on different AI providers without changing any other code.",
    what: "A single switch that routes every AI call to Gemini API or Vertex AI.",
    input: "A prompt plus which provider and credentials to use.",
    output: "The model's response, from whichever provider is selected.",
  },
  gemapi: {
    why: "The quickest way to run the app — just one free API key.",
    what: "Google's hosted Gemini service, accessed with an API key.",
    input: "Prompts and your Gemini API key.",
    output: "Generated text (the plan or the page).",
  },
  vertex: {
    why: "The enterprise option — runs on your own Google Cloud project.",
    what: "Google Cloud's Vertex AI, accessed with a service account.",
    input: "Prompts and your Cloud project credentials.",
    output: "Generated text (the plan or the page).",
  },
  flash: {
    why: "The actual brain that writes the strategy and the page.",
    what: "Google's Gemini 2.5 model that generates the text.",
    input: "The prompts from the Strategist and Generator.",
    output: "The marketing plan and the HTML page.",
  },
};

// [from, to, label, "udip"?]
const EDGES: string[][] = [
  ["chat", "front", "brief · approve"],
  ["hist", "front", "creds"],
  ["photo", "front", "photos"],
  ["front", "plan", "POST"],
  ["front", "gen", "POST"],
  ["plan", "strat", "run"],
  ["gen", "gener", "run"],
  ["strat", "appr", "plan", "udip"],
  ["appr", "gener", "approved", "udip"],
  ["strat", "seam", "callModel()"],
  ["gener", "seam", "callModel()"],
  ["seam", "gemapi", ""],
  ["seam", "vertex", ""],
  ["gemapi", "flash", ""],
  ["vertex", "flash", ""],
];

const cx = (b: BoxDef) => b.x + b.w / 2;

function vedge(s: BoxDef, t: BoxDef) {
  const sx = cx(s), sy = s.y + s.h, tx = cx(t), ty = t.y;
  const midY = (sy + ty) / 2;
  // Straight vertical: keep the label near the source so it never collides with
  // the target layer's heading.
  if (Math.abs(sx - tx) < 1) return { d: `M${sx} ${sy}L${tx} ${ty}`, lx: sx, ly: sy + 26 };
  const r = 8, dir = tx > sx ? 1 : -1;
  const d = `M${sx} ${sy}L${sx} ${midY - r}Q${sx} ${midY} ${sx + dir * r} ${midY}L${tx - dir * r} ${midY}Q${tx} ${midY} ${tx} ${midY + r}L${tx} ${ty}`;
  return { d, lx: (sx + tx) / 2, ly: midY };
}

function uedge(s: BoxDef, t: BoxDef) {
  const sx = cx(s), sy = s.y + s.h, tx = cx(t), ty = t.y + t.h, dipY = sy + 30;
  const r = 8, dir = tx > sx ? 1 : -1;
  const d = `M${sx} ${sy}L${sx} ${dipY - r}Q${sx} ${dipY} ${sx + dir * r} ${dipY}L${tx - dir * r} ${dipY}Q${tx} ${dipY} ${tx} ${dipY - r}L${tx} ${ty}`;
  return { d, lx: (sx + tx) / 2, ly: dipY };
}

function tipPos(b: BoxDef) {
  const W = 352, H = 250;
  let tx = b.x + b.w + 16;
  if (tx + W > 1150) tx = b.x - W - 16;
  let ty = b.y - 8;
  if (ty + H > 1430) ty = 1430 - H;
  if (ty < -110) ty = -110;
  return { tx, ty, W, H };
}

export default function ArchitectureDiagram() {
  const [hovered, setHovered] = useState<string | null>(null);
  const hb = hovered ? BOXES[hovered] : null;
  const ins = hovered ? INSIGHTS[hovered] : null;
  const pos = hb ? tipPos(hb) : null;

  return (
    <svg className="arch-svg" viewBox="-60 -120 1220 1560" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="archdots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill="#d6d6db" />
        </pattern>
        <marker id="archhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#667085" />
        </marker>
      </defs>

      <rect x="-60" y="-120" width="1220" height="1560" fill="#f4f4f5" />
      <rect x="-60" y="-120" width="1220" height="1560" fill="url(#archdots)" />

      <text x="0" y="-58" fontSize="32" fontWeight="700" fill="#1d1d1f">PageForge — Architecture</text>
      <text x="2" y="-28" fontSize="15" fill="#6e6e73">
        Strategy-first, two-agent landing-page generator · hover any box for details
      </text>

      {LAYERS.map((L, i) => (
        <g key={"L" + i}>
          <rect x={L.x} y={L.y} width={L.w} height={L.h} rx="16" fill="#ffffff" stroke="#d0d5dd" strokeWidth="1.5" />
          <text x={L.x + 18} y={L.y - 9} fontSize="13" fontWeight="700" fill={L.color} letterSpacing="1.2">
            {L.label}
          </text>
        </g>
      ))}

      {EDGES.map((e, i) => {
        const s = BOXES[e[0]], t = BOXES[e[1]];
        const r = e[3] === "udip" ? uedge(s, t) : vedge(s, t);
        const label = e[2];
        return (
          <g key={"e" + i}>
            <path d={r.d} fill="none" stroke="#667085" strokeWidth="2" markerEnd="url(#archhead)" />
            {label && (
              <>
                <rect x={r.lx - (label.length * 3 + 6)} y={r.ly - 9} width={label.length * 6 + 12} height="17" rx="4" fill="#f4f4f5" />
                <text x={r.lx} y={r.ly + 3} fontSize="11.5" fill="#475569" textAnchor="middle">{label}</text>
              </>
            )}
          </g>
        );
      })}

      {Object.entries(BOXES).map(([k, b]) => {
        const ccx = b.x + b.w / 2, ccy = b.y + b.h / 2;
        const active = hovered === k;
        return (
          <g
            key={k}
            onMouseEnter={() => setHovered(k)}
            onMouseLeave={() => setHovered((h) => (h === k ? null : h))}
          >
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="12" fill={b.fill} stroke={b.stroke} strokeWidth={active ? 3.5 : 2} />
            <text textAnchor="middle" x={ccx} fill="#eef3f8">
              <tspan x={ccx} y={ccy - 3} fontSize="15" fontWeight="600">{b.title}</tspan>
              <tspan x={ccx} y={ccy + 15} fontSize="11.5" fill="#aebccb">{b.sub}</tspan>
            </text>
          </g>
        );
      })}

      {hb && ins && pos && (
        <foreignObject x={pos.tx} y={pos.ty} width={pos.W} height={pos.H} style={{ pointerEvents: "none" }}>
          <div className="arch-tip">
            <div className="arch-tip-title" style={{ color: hb.stroke }}>{hb.title}</div>
            <div className="arch-tip-row">
              <span>Why it&apos;s here</span>
              <p>{ins.why}</p>
            </div>
            <div className="arch-tip-row">
              <span>What it does</span>
              <p>{ins.what}</p>
            </div>
            <div className="arch-tip-row">
              <span>Input</span>
              <p>{ins.input}</p>
            </div>
            <div className="arch-tip-row">
              <span>Output</span>
              <p>{ins.output}</p>
            </div>
          </div>
        </foreignObject>
      )}
    </svg>
  );
}
