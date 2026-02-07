import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/instances/[id]/whatsapp/status
 * 
 * Check WhatsApp connection status for an instance.
 * 
 * PHASE 2 - TODO
 * 
 * This endpoint will:
 * 1. Check if WhatsApp session exists
 * 2. Verify connection is active
 * 3. Return phone number and status
 * 
 * Response format:
 * {
 *   connected: boolean,
 *   phone_number?: string,  // Masked: +1 *** *** 1234
 *   connected_at?: string,
 *   session_valid: boolean
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { 
      error: "WhatsApp integration not yet available",
      message: "WhatsApp support is coming in Phase 2. Use Telegram for now.",
      phase: 2
    },
    { status: 501 }
  );
}
