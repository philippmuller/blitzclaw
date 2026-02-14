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
import { InstanceStatus, prisma } from "@blitzclaw/db";
import { auth } from "@clerk/nextjs/server";
import {
  BROWSER_RELAY_TOKEN_VALIDITY_MS,
  generateBrowserRelayToken,
  validateBrowserRelayToken,
} from "@/lib/browser-relay-token";

export const runtime = "nodejs";

const TOKEN_TEST_PREFIX = "brc_test_";

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

    // Generate stateless signed token
    const token = generateBrowserRelayToken(resolvedInstanceId);

    return NextResponse.json({
      token,
      instanceId: resolvedInstanceId,
      expiresIn: BROWSER_RELAY_TOKEN_VALIDITY_MS / 1000,
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
  const action = req.nextUrl.searchParams.get("action");
  const token = req.nextUrl.searchParams.get("token");
  const instanceId = req.nextUrl.searchParams.get("instanceId");

  if (action === "validate") {
    if (!token) {
      return NextResponse.json({ valid: false, error: "Missing token" }, { status: 400 });
    }

    // Allow test tokens for development/testing
    if (token.startsWith(TOKEN_TEST_PREFIX)) {
      const testInstanceId = token.replace(TOKEN_TEST_PREFIX, "test-");
      if (instanceId && instanceId !== testInstanceId) {
        return NextResponse.json(
          { valid: false, error: "Token instance mismatch" },
          { status: 403 }
        );
      }

      return NextResponse.json({
        valid: true,
        instanceId: testInstanceId,
        wsUrl: getWebSocketUrl(testInstanceId),
      });
    }

    // Validate stateless HMAC-signed token
    const result = validateBrowserRelayToken(token);
    if (result.valid === false) {
      const status = result.error === "Token expired" ? 410 : 400;
      return NextResponse.json(
        { valid: false, error: result.error },
        { status }
      );
    }

    if (instanceId && instanceId !== result.instanceId) {
      return NextResponse.json(
        { valid: false, error: "Token instance mismatch" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid: true,
      instanceId: result.instanceId,
      expiresAt: result.expiresAt,
      wsUrl: getWebSocketUrl(result.instanceId),
    });
  }

  if (action === "validate-agent") {
    const instanceSecret = req.headers.get("x-instance-secret");
    if (!instanceSecret) {
      return NextResponse.json({ valid: false, error: "Missing x-instance-secret header" }, { status: 401 });
    }

    if (!instanceId) {
      return NextResponse.json({ valid: false, error: "Missing instanceId" }, { status: 400 });
    }

    const instance = await prisma.instance.findUnique({
      where: { proxySecret: instanceSecret },
      select: { id: true, status: true },
    });

    if (!instance) {
      return NextResponse.json({ valid: false, error: "Invalid instance secret" }, { status: 401 });
    }

    if (instance.id !== instanceId) {
      return NextResponse.json({ valid: false, error: "Agent not authorized for this relay room" }, { status: 403 });
    }

    if (
      instance.status !== InstanceStatus.ACTIVE &&
      instance.status !== InstanceStatus.PROVISIONING
    ) {
      return NextResponse.json(
        { valid: false, error: `Instance is ${instance.status.toLowerCase()}` },
        { status: 409 }
      );
    }

    return NextResponse.json({
      valid: true,
      instanceId: instance.id,
      wsUrl: getWebSocketUrl(instance.id),
    });
  }

  // Return relay status
  return NextResponse.json({
    status: "ok",
    note: "WebSocket connections handled by separate server",
  });
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
