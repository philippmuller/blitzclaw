/**
 * Proxy Health Check Endpoint
 * 
 * Used by instances and monitoring to verify the proxy is operational.
 */

import { NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

/**
 * GET /api/proxy/health - Health check
 */
export async function GET() {
  const checks = {
    status: "ok" as "ok" | "degraded" | "error",
    timestamp: new Date().toISOString(),
    services: {
      database: "unknown" as "ok" | "error",
      anthropic: "unknown" as "ok" | "error" | "not_configured",
    },
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.services.database = "ok";
  } catch (error) {
    console.error("Database health check failed:", error);
    checks.services.database = "error";
    checks.status = "degraded";
  }

  // Check if Anthropic API key is configured
  if (process.env.ANTHROPIC_API_KEY) {
    // Could optionally make a test call, but for now just check it exists
    checks.services.anthropic = "ok";
  } else {
    checks.services.anthropic = "not_configured";
    if (process.env.NODE_ENV === "production") {
      checks.status = "degraded";
    }
  }

  const statusCode = checks.status === "ok" ? 200 : 503;
  
  return NextResponse.json(checks, { status: statusCode });
}
