import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@blitzclaw/db"],
  // Exclude ssh2 from bundling - it has native bindings that don't work in serverless
  serverExternalPackages: ["ssh2"],
};

export default nextConfig;
