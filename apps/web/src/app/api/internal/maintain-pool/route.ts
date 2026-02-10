/**
 * Internal endpoint to maintain the server pool
 * 
 * Called by cron job to ensure we have MIN_POOL_SIZE servers ready.
 * Also cleans up stuck provisioning servers.
 * 
 * Protected by internal secret (not exposed to public).
 */

import { NextRequest, NextResponse } from "next/server";
import { maintainPool, getPoolStatus } from "@/lib/provisioning";

// Simple auth for internal endpoints
const INTERNAL_SECRET = process.env.PROXY_SIGNING_SECRET || process.env.CLERK_SECRET_KEY;

export async function POST(req: NextRequest) {
  // Verify internal secret
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");
  
  if (!INTERNAL_SECRET || providedSecret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("🔧 Maintaining server pool...");
    
    // Get current status
    const beforeStatus = await getPoolStatus();
    console.log("Pool status before:", beforeStatus);
    
    // Run maintenance
    const result = await maintainPool();
    
    // Get updated status
    const afterStatus = await getPoolStatus();
    console.log("Pool status after:", afterStatus);
    
    return NextResponse.json({
      success: true,
      before: beforeStatus,
      after: afterStatus,
      provisioned: result.provisioned,
      cleaned: result.cleaned,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Pool maintenance failed:", error);
    return NextResponse.json(
      { error: "Pool maintenance failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Also support GET for status check
export async function GET(req: NextRequest) {
  // Verify internal secret
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");
  
  if (!INTERNAL_SECRET || providedSecret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getPoolStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("Failed to get pool status:", error);
    return NextResponse.json(
      { error: "Failed to get pool status", details: (error as Error).message },
      { status: 500 }
    );
  }
}
