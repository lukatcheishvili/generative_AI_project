"use client";

/**
 * Accurate, themed architecture diagram of the PageForge agent app.
 * Pure SVG so it scales and adapts to light/dark via CSS variables.
 */

function Group({
  x,
  y,
  w,
  h,
  label,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}) {
  return (
    <g>
      <rect className="arch-group" x={x} y={y} width={w} height={h} rx={14} />
      <rect
        className="arch-grouplabel-bg"
        x={x + 14}
        y={y - 11}
        width={label.length * 7.2 + 22}
        height={22}
        rx={6}
      />
      <text className="arch-grouplabel-text" x={x + 25} y={y + 4}>
        {label}
      </text>
    </g>
  );
}

function Box({
  x,
  y,
  w,
  h,
  title,
  sub,
  accent,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <g>
      <rect
        className={`arch-box ${accent ? "accent" : ""}`}
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
      />
      <text
        className="arch-title"
        x={x + w / 2}
        y={y + (sub ? h / 2 - 4 : h / 2 + 4)}
        textAnchor="middle"
      >
        {title}
      </text>
      {sub && (
        <text className="arch-sub" x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle">
          {sub}
        </text>
      )}
    </g>
  );
}

function Edge({
  d,
  label,
  lx,
  ly,
  dashed,
}: {
  d: string;
  label?: string;
  lx?: number;
  ly?: number;
  dashed?: boolean;
}) {
  return (
    <g>
      <path
        className={`arch-edge ${dashed ? "dashed" : ""}`}
        d={d}
        markerEnd="url(#arch-arrow)"
      />
      {label && lx != null && ly != null && (
        <>
          <rect
            className="arch-edge-label-bg"
            x={lx - (label.length * 3 + 6)}
            y={ly - 9}
            width={label.length * 6 + 12}
            height={16}
            rx={4}
          />
          <text className="arch-edge-label" x={lx} y={ly + 3} textAnchor="middle">
            {label}
          </text>
        </>
      )}
    </g>
  );
}

export default function ArchitectureDiagram() {
  return (
    <svg className="arch-svg" viewBox="0 0 960 1000" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker
          id="arch-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path className="arch-marker" d="M0,0 L10,5 L0,10 z" />
        </marker>
      </defs>

      {/* CLIENT */}
      <Group x={60} y={22} w={840} h={150} label="CLIENT · BROWSER" />
      <Box x={95} y={62} w={235} h={80} title="Chat UI" sub="composer · plan card · live preview" />
      <Box x={362} y={62} w={235} h={80} title="Conversations & Settings" sub="stored in your browser" />
      <Box x={628} y={62} w={235} h={80} title="Photo upload" sub="resized → base64" />

      <Edge d="M480,172 L480,212" label="brief · approve  (HTTPS + SSE)" lx={480} ly={192} />

      {/* VERCEL */}
      <Group x={60} y={222} w={840} h={205} label="VERCEL · NEXT.JS (APP ROUTER)" />
      <Box x={300} y={258} w={360} h={58} title="Frontend — page.tsx" sub="server-rendered + interactive UI" />
      <Edge d="M425,316 L340,350" />
      <Edge d="M535,316 L620,350" />
      <Box x={170} y={350} w={290} h={58} title="/api/plan" sub="Strategist route · SSE stream" />
      <Box x={500} y={350} w={290} h={58} title="/api/generate" sub="Generator route · SSE stream" />

      <Edge d="M480,427 L480,467" label="invoke agents (LangGraph)" lx={480} ly={447} />

      {/* AGENTS */}
      <Group x={60} y={477} w={840} h={170} label="AGENTS · LANGGRAPH PIPELINE" />
      <Box x={92} y={520} w={236} h={92} title="Strategist" sub="brief → marketing plan" accent />
      <Box x={362} y={520} w={236} h={92} title="Human approval" sub="edit & confirm the plan" accent />
      <Box x={632} y={520} w={236} h={92} title="Generator" sub="plan + photos → HTML" accent />
      <Edge d="M328,566 L360,566" label="plan" lx={344} ly={560} />
      <Edge d="M598,566 L630,566" label="approved" lx={614} ly={560} />

      <Edge d="M480,647 L480,687" label="callModel(prompt, model, creds)" lx={480} ly={667} />

      {/* PROVIDER SEAM */}
      <Group x={60} y={697} w={840} h={92} label="PROVIDER SEAM · lib/llm.ts" />
      <Box x={300} y={725} w={360} h={56} title="Provider seam" sub="gemini | vertex · per-request creds" />

      <Edge d="M480,781 L320,829" />
      <Edge d="M480,781 L640,829" />

      {/* LLM */}
      <Group x={60} y={799} w={840} h={180} label="LLM · GOOGLE" />
      <Box x={180} y={829} w={240} h={64} title="Gemini API" sub="API key" />
      <Box x={540} y={829} w={240} h={64} title="Vertex AI" sub="service account · region" />
      <Box x={300} y={909} w={360} h={56} title="Google Gemini 2.5 Flash" sub="Strategist 0.6 · Generator 0.8" />
      <Edge d="M300,893 L430,909" />
      <Edge d="M660,893 L530,909" />

      {/* Return path: responses stream back to the client */}
      <Edge d="M915,545 L915,150" dashed />
      <rect className="arch-edge-label-bg" x={772} y={126} width={138} height={16} rx={4} />
      <text className="arch-edge-label" x={905} y={137} textAnchor="end">
        response (SSE): plan / HTML
      </text>
    </svg>
  );
}
