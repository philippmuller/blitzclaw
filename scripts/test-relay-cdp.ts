#!/usr/bin/env npx tsx
/**
 * Browser Relay smoke test:
 * 1) Generate relay token via API (agent auth)
 * 2) Validate token via API
 * 3) Run CDP commands via /api/browser-relay/cdp
 *
 * Usage:
 *   npx tsx scripts/test-relay-cdp.ts [instanceId]
 */

import { prisma } from "@blitzclaw/db";

const API_BASE = process.env.API_BASE || "https://www.blitzclaw.com";

type RelayTokenResponse = {
  token: string;
  instanceId: string;
  connectUrl?: string;
  wsUrl?: string;
  expiresIn?: number;
  error?: string;
};

async function main() {
  const requestedInstanceId = process.argv[2];
  const instance = await loadInstance(requestedInstanceId);

  if (!instance) {
    console.error("No active instance found.");
    process.exit(1);
  }

  console.log(`\nInstance: ${instance.name || instance.id}`);
  console.log(`Instance ID: ${instance.id}`);

  const tokenResponse = await generateRelayToken(instance.proxySecret, instance.id);
  console.log("\nToken generated");
  console.log(`Token prefix: ${tokenResponse.token.slice(0, 22)}...`);
  if (tokenResponse.connectUrl) {
    console.log(`Connect URL: ${tokenResponse.connectUrl}`);
  }
  if (tokenResponse.wsUrl) {
    console.log(`Relay WS URL: ${tokenResponse.wsUrl}`);
  }
  if (tokenResponse.expiresIn) {
    console.log(`Expires in: ${tokenResponse.expiresIn}s`);
  }

  const validation = await validateToken(tokenResponse.token, instance.id);
  console.log("\nToken validation");
  console.log(JSON.stringify(validation, null, 2));

  console.log("\nOpen the connect URL in Chrome and click 'Allow and Connect'.");
  console.log("Press Enter when extension is connected (Ctrl+C to abort).");
  await waitForEnter();

  await runCdpTest(instance.proxySecret, "Runtime.evaluate", {
    expression: "document.title",
  });
  await runCdpTest(instance.proxySecret, "Runtime.evaluate", {
    expression: "location.href",
  });

  console.log("\nDone.");
}

async function loadInstance(instanceId?: string) {
  if (instanceId) {
    return prisma.instance.findUnique({
      where: { id: instanceId },
      select: { id: true, name: true, proxySecret: true, status: true },
    });
  }

  return prisma.instance.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, proxySecret: true, status: true },
  });
}

async function generateRelayToken(instanceSecret: string, instanceId: string): Promise<RelayTokenResponse> {
  const response = await fetch(`${API_BASE}/api/browser-relay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-instance-secret": instanceSecret,
    },
    body: JSON.stringify({ instanceId }),
  });

  const data = (await response.json()) as RelayTokenResponse;
  if (!response.ok || !data.token) {
    throw new Error(data.error || `Token generation failed (${response.status})`);
  }
  return data;
}

async function validateToken(token: string, expectedInstanceId: string) {
  const url = new URL(`${API_BASE}/api/browser-relay`);
  url.searchParams.set("action", "validate");
  url.searchParams.set("token", token);
  url.searchParams.set("instanceId", expectedInstanceId);

  const response = await fetch(url.toString());
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Validation failed (${response.status})`);
  }
  return data;
}

async function runCdpTest(instanceSecret: string, method: string, params?: Record<string, unknown>) {
  console.log(`\nCDP ${method}`);
  const response = await fetch(`${API_BASE}/api/browser-relay/cdp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-instance-secret": instanceSecret,
    },
    body: JSON.stringify({
      method,
      params: params || {},
      timeoutMs: 25000,
    }),
  });

  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `CDP failed (${response.status})`);
  }
  console.log(JSON.stringify(data, null, 2));
}

function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => resolve());
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`\nTest failed: ${message}`);
  process.exit(1);
});
