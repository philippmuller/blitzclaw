import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/instances/[id]/whatsapp/qr
 * 
 * Generate QR code for WhatsApp Web pairing.
 * 
 * PHASE 2 - TODO
 * 
 * This endpoint will:
 * 1. Initiate WhatsApp session on the instance
 * 2. Generate QR code
 * 3. Return QR data for display in dashboard
 * 
 * Response format:
 * {
 *   qr_code: string,  // Base64 encoded QR image or data URL
 *   session_id: string,
 *   expires_in: number  // Seconds until QR expires
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
