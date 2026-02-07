import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/instances/[id]/whatsapp/disconnect
 * 
 * Disconnect WhatsApp from an instance.
 * 
 * PHASE 2 - TODO
 * 
 * This endpoint will:
 * 1. Close active WhatsApp connection
 * 2. Clear session data
 * 3. Update instance config
 * 
 * Response format:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
export async function POST(
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
