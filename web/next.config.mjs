/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The agent SDKs (LangGraph, Google) are server-only; keep them out of the client bundle.
    serverComponentsExternalPackages: ["@langchain/langgraph", "@google-cloud/vertexai"],
  },
};

export default nextConfig;
