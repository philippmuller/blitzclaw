import { NextRequest, NextResponse } from "next/server";
import { InstanceStatus, prisma } from "@blitzclaw/db";
import { getSharedBrowserRelayClient } from "@/lib/browser-relay-client";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
const RELAY_DEBUG_ENABLED = process.env.BROWSER_RELAY_DEBUG === "1";

type CdpRequestBody = {
  method: string;
  params?: Record<string, unknown>;
  timeoutMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequestBody(body: unknown): { ok: true; value: CdpRequestBody } | { ok: false; error: string } {
  if (!isRecord(body)) {
    return { ok: false, error: "Body must be a JSON object" };
  }

  const method = body.method;
  if (typeof method !== "string" || method.trim().length === 0) {
    return { ok: false, error: "method must be a non-empty string" };
  }

  const params = body.params;
  if (params !== undefined && !isRecord(params)) {
    return { ok: false, error: "params must be an object when provided" };
  }

  const timeoutMs = body.timeoutMs;
  if (
    timeoutMs !== undefined &&
    (typeof timeoutMs !== "number" ||
      !Number.isFinite(timeoutMs) ||
      timeoutMs < 100 ||
      timeoutMs > 120000)
  ) {
    return { ok: false, error: "timeoutMs must be a number between 100 and 120000" };
  }

  return {
    ok: true,
    value: {
      method: method.trim(),
      params: params as Record<string, unknown> | undefined,
      timeoutMs: timeoutMs as number | undefined,
    },
  };
}

function mapRelayErrorStatus(errorMessage: string): number {
  const normalized = errorMessage.toLowerCase();

  if (normalized.includes("extension not connected")) {
    return 409;
  }

  if (normalized.includes("timed out")) {
    return 504;
  }

  if (normalized.includes("auth")) {
    return 401;
  }

  if (normalized.includes("socket") || normalized.includes("connection")) {
    return 502;
  }

  return 500;
}

/**
 * POST /api/browser-relay/cdp
 *
 * Auth: x-instance-secret header (instance proxySecret)
 * Body: { method: string, params?: object, timeoutMs?: number }
 */
export async function POST(req: NextRequest) {
  const requestId = randomUUID().slice(0, 8);
  const instanceSecret = req.headers.get("x-instance-secret");
  if (!instanceSecret) {
    return NextResponse.json({ error: "Missing x-instance-secret header" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseRequestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const instance = await prisma.instance.findUnique({
    where: { proxySecret: instanceSecret },
    select: { id: true, status: true },
  });

  if (!instance) {
    return NextResponse.json({ error: "Invalid instance secret" }, { status: 401 });
  }

  if (instance.status === InstanceStatus.PAUSED) {
    return NextResponse.json({ error: "Instance paused" }, { status: 403 });
  }

  if (
    instance.status !== InstanceStatus.ACTIVE &&
    instance.status !== InstanceStatus.PROVISIONING
  ) {
    return NextResponse.json(
      { error: `Instance is ${instance.status.toLowerCase()}` },
      { status: 409 }
    );
  }

  const relayClient = getSharedBrowserRelayClient({
    instanceId: instance.id,
    instanceSecret,
  });

  if (RELAY_DEBUG_ENABLED) {
    console.info(`[browser-relay][cdp][${requestId}] dispatch`, {
      instanceId: instance.id,
      method: parsed.value.method,
      timeoutMs: parsed.value.timeoutMs ?? null,
      relayState: relayClient.connectionState,
      extensionConnected: relayClient.isExtensionConnected,
    });
  }

  try {
    const result = await relayClient.sendCdpCommand(
      parsed.value.method,
      parsed.value.params ?? {},
      parsed.value.timeoutMs ? { timeoutMs: parsed.value.timeoutMs } : undefined
    );

    return NextResponse.json({
      ok: true,
      requestId,
      method: parsed.value.method,
      result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to execute CDP command";
    if (RELAY_DEBUG_ENABLED) {
      console.error(`[browser-relay][cdp][${requestId}] failed`, {
        instanceId: instance.id,
        method: parsed.value.method,
        error: errorMessage,
        relayState: relayClient.connectionState,
        extensionConnected: relayClient.isExtensionConnected,
      });
    }
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: errorMessage,
      },
      { status: mapRelayErrorStatus(errorMessage) }
    );
  }
}
