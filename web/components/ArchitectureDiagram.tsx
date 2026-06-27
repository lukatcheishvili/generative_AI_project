"use client";

/**
 * Faithful SVG recreation of the PageForge architecture flow (matches the Figma
 * board): dotted light canvas, layered containers, dark boxes with colored
 * borders per layer, and labeled elbow connectors. Fixed colors (light) so it
 * looks identical in either app theme.
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
  if (Math.abs(sx - tx) < 1) return { d: `M${sx} ${sy}L${tx} ${ty}`, lx: sx, ly: midY };
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

export default function ArchitectureDiagram() {
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
        Strategy-first, two-agent landing-page generator · request flow top → bottom
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
        return (
          <g key={k}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="12" fill={b.fill} stroke={b.stroke} strokeWidth="2" />
            <text textAnchor="middle" x={ccx} fill="#eef3f8">
              <tspan x={ccx} y={ccy - 3} fontSize="15" fontWeight="600">{b.title}</tspan>
              <tspan x={ccx} y={ccy + 15} fontSize="11.5" fill="#aebccb">{b.sub}</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}
