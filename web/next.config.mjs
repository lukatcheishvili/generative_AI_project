/** @type {import('next').NextConfig} */

// The backend is now a separate Python service (FastAPI + LangGraph) in ../server.
// We proxy the two API paths to it so the UI keeps calling same-origin /api/*
// with zero changes. Override the target with PY_BACKEND_URL (e.g. in prod).
const PY_BACKEND_URL = process.env.PY_BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/plan", destination: `${PY_BACKEND_URL}/api/plan` },
      { source: "/api/generate", destination: `${PY_BACKEND_URL}/api/generate` },
    ];
  },
};

export default nextConfig;
