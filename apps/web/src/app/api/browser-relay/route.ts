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
import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "crypto";

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
 * Called by dashboard or agent when browser access is required
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { instanceId } = body;

    let resolvedInstanceId: string | null = null;
    const instanceSecret = req.headers.get("x-instance-secret");

    if (instanceSecret) {
      // Agent flow: authenticate using instance proxy secret.
      const secretInstance = await prisma.instance.findFirst({
        where: {
          proxySecret: instanceSecret,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      if (!secretInstance) {
        return NextResponse.json({ error: "Invalid instance secret" }, { status: 401 });
      }

      if (instanceId && instanceId !== secretInstance.id) {
        return NextResponse.json(
          { error: "instanceId does not match authenticated instance" },
          { status: 403 }
        );
      }

      resolvedInstanceId = secretInstance.id;
    } else {
      // Dashboard flow: authenticate with Clerk session.
      if (!instanceId) {
        return NextResponse.json(
          { error: "Missing instanceId" },
          { status: 400 }
        );
      }

      const { userId: clerkId } = await auth();
      if (!clerkId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Verify instance belongs to user
      const userInstance = await prisma.instance.findFirst({
        where: {
          id: instanceId,
          userId: user.id,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      if (!userInstance) {
        return NextResponse.json(
          { error: "Instance not found or not active" },
          { status: 404 }
        );
      }

      resolvedInstanceId = userInstance.id;
    }

    // Generate token
    const token = generateToken();
    const now = Date.now();

    // Store pending connection
    pendingConnections.set(token, {
      token,
      instanceId: resolvedInstanceId,
      createdAt: now,
      expiresAt: now + TOKEN_VALIDITY_MS,
    });

    // Clean up expired tokens
    cleanupExpiredTokens();

    return NextResponse.json({
      token,
      instanceId: resolvedInstanceId,
      expiresIn: TOKEN_VALIDITY_MS / 1000,
      wsUrl: getWebSocketUrl(resolvedInstanceId),
      connectUrl: getConnectUrl(req, token, resolvedInstanceId),
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
    // Allow test tokens for development/testing
    if (token.startsWith("brc_test_")) {
      const testInstanceId = token.replace("brc_test_", "test-");
      return NextResponse.json({
        valid: true,
        instanceId: testInstanceId,
      });
    }

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
  // 24 bytes => 32 chars in base64url
  return `brc_${randomBytes(24).toString("base64url")}`;
}

// Helper: Get WebSocket URL
function getWebSocketUrl(instanceId?: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_PARTYKIT_URL || 'wss://blitzclaw-relay.philippmuller.partykit.dev/parties/main';
  if (!instanceId) {
    return baseUrl;
  }
  return `${baseUrl.replace(/\/$/, '')}/${instanceId}`;
}

// Helper: Build link users open to approve browser connection
function getConnectUrl(req: NextRequest, token: string, instanceId: string): string {
  const url = new URL("/relay/connect", req.nextUrl.origin);
  url.searchParams.set("token", token);
  url.searchParams.set("instance", instanceId);
  return url.toString();
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
