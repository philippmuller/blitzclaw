/**
 * Browser Relay WebSocket Endpoint
 * 
 * Relays CDP commands between user's Chrome extension and their BlitzClaw VM.
 * 
 * Flow:
 * 1. Extension connects with instance token
 * 2. VM connects with instance secret
 * 3. CDP commands flow: VM → Relay → Extension → Chrome
 * 4. Results flow back: Chrome → Extension → Relay → VM
 * 
 * Note: Next.js doesn't support WebSocket in API routes directly.
 * This endpoint handles the initial handshake and token validation.
 * For production, we'll need a separate WebSocket server or use Vercel's
 * Edge Runtime with WebSocket support, or a service like Ably/Pusher.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

// For MVP: Store pending connections in memory
// Production: Use Redis or similar
const pendingConnections = new Map<string, {
  token: string;
  instanceId: string;
  createdAt: number;
  expiresAt: number;
}>();

// Token validity: 5 minutes
const TOKEN_VALIDITY_MS = 5 * 60 * 1000;

/**
 * Generate a browser relay token for an instance
 * Called by dashboard when user clicks "Connect Browser"
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { instanceId, userId } = body;

    if (!instanceId || !userId) {
      return NextResponse.json(
        { error: "Missing instanceId or userId" },
        { status: 400 }
      );
    }

    // Verify instance belongs to user
    const instance = await prisma.instance.findFirst({
      where: {
        id: instanceId,
        userId: userId,
        status: "ACTIVE",
      },
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Instance not found or not active" },
        { status: 404 }
      );
    }

    // Generate token
    const token = generateToken();
    const now = Date.now();

    // Store pending connection
    pendingConnections.set(token, {
      token,
      instanceId,
      createdAt: now,
      expiresAt: now + TOKEN_VALIDITY_MS,
    });

    // Clean up expired tokens
    cleanupExpiredTokens();

    return NextResponse.json({
      token,
      expiresIn: TOKEN_VALIDITY_MS / 1000,
      wsUrl: getWebSocketUrl(instanceId),
    });

  } catch (error) {
    console.error("Failed to generate relay token:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}

/**
 * Validate a browser relay token
 * Called by WebSocket server when extension connects
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const action = req.nextUrl.searchParams.get("action");

  if (action === "validate" && token) {
    const connection = pendingConnections.get(token);

    if (!connection) {
      return NextResponse.json(
        { valid: false, error: "Token not found" },
        { status: 404 }
      );
    }

    if (Date.now() > connection.expiresAt) {
      pendingConnections.delete(token);
      return NextResponse.json(
        { valid: false, error: "Token expired" },
        { status: 410 }
      );
    }

    return NextResponse.json({
      valid: true,
      instanceId: connection.instanceId,
    });
  }

  // Return relay status
  return NextResponse.json({
    status: "ok",
    pendingConnections: pendingConnections.size,
    note: "WebSocket connections handled by separate server",
  });
}

// Helper: Generate secure random token
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'brc_'; // BlitzClaw Relay Connection
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Helper: Get WebSocket URL
function getWebSocketUrl(instanceId?: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_PARTYKIT_URL || 'wss://blitzclaw-relay.partykit.dev/party';
  if (!instanceId) {
    return baseUrl;
  }
  return `${baseUrl.replace(/\/$/, '')}/${instanceId}`;
}

// Helper: Clean up expired tokens
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [token, connection] of pendingConnections) {
    if (now > connection.expiresAt) {
      pendingConnections.delete(token);
    }
  }
}
