/** @type {import('next').NextConfig} */

// The backend is a separate Python service (FastAPI + LangGraph) in ../server.
// We proxy the two API paths to it so the UI keeps calling same-origin /api/*
// with zero changes. Backend URL resolution order:
//   1. PY_BACKEND_URL env var (explicit override — set this to use a different host)
//   2. on Vercel: the deployed Render backend (sensible production default)
//   3. local dev: localhost:8000 (run `uvicorn app.main:app --port 8000`)
const PY_BACKEND_URL =
  process.env.PY_BACKEND_URL ||
  (process.env.VERCEL
    ? "https://generative-ai-project-py.onrender.com"
    : "http://127.0.0.1:8000");

const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/plan", destination: `${PY_BACKEND_URL}/api/plan` },
      { source: "/api/generate", destination: `${PY_BACKEND_URL}/api/generate` },
    ];
  },
};

export default nextConfig;
