/**
 * Test script for Hetzner API integration
 * 
 * Run with: npx ts-node --esm scripts/test-hetzner.ts
 */

import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const HETZNER_API_URL = "https://api.hetzner.cloud/v1";

async function hetznerRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = process.env.HETZNER_API_TOKEN;
  if (!token) {
    throw new Error("HETZNER_API_TOKEN not set");
  }

  console.log(`→ ${options.method || "GET"} ${endpoint}`);

  const response = await fetch(`${HETZNER_API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: "Request failed" } }));
    throw new Error(`Hetzner API error: ${error.error?.message || response.statusText}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

async function main() {
  console.log("🔧 Testing Hetzner API Integration\n");

  // 1. List servers
  console.log("1️⃣  Listing existing BlitzClaw servers...");
  const existingServers = await hetznerRequest<{ servers: any[] }>(
    "/servers?label_selector=service=blitzclaw"
  );
  console.log(`   Found ${existingServers.servers.length} existing server(s)\n`);

  // 2. Create a test server
  console.log("2️⃣  Creating test server...");
  const serverName = `blitz-test-${Date.now()}`;
  const createResponse = await hetznerRequest<{
    server: { id: number; public_net: { ipv4: { ip: string } } };
    root_password: string | null;
  }>("/servers", {
    method: "POST",
    body: JSON.stringify({
      name: serverName,
      server_type: "cpx11",
      image: "ubuntu-24.04",
      location: "ash",
      labels: {
        service: "blitzclaw",
        type: "test",
      },
      start_after_create: true,
    }),
  });

  const serverId = createResponse.server.id;
  const ipAddress = createResponse.server.public_net.ipv4.ip;

  console.log(`   ✓ Created server:`);
  console.log(`     ID: ${serverId}`);
  console.log(`     Name: ${serverName}`);
  console.log(`     IP: ${ipAddress}`);
  console.log(`     Password: ${createResponse.root_password || "(none)"}\n`);

  // 3. Wait a moment
  console.log("3️⃣  Waiting 10 seconds for server to initialize...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // 4. Get server details
  console.log("4️⃣  Fetching server details...");
  const serverDetails = await hetznerRequest<{ server: any }>(`/servers/${serverId}`);
  console.log(`   Status: ${serverDetails.server.status}`);
  console.log(`   Datacenter: ${serverDetails.server.datacenter.name}\n`);

  // 5. Delete the server
  console.log("5️⃣  Deleting test server...");
  await hetznerRequest(`/servers/${serverId}`, { method: "DELETE" });
  console.log(`   ✓ Server ${serverId} deleted\n`);

  // 6. Final list
  console.log("6️⃣  Verifying cleanup...");
  const finalServers = await hetznerRequest<{ servers: any[] }>(
    "/servers?label_selector=service=blitzclaw"
  );
  console.log(`   ${finalServers.servers.length} BlitzClaw server(s) remaining\n`);

  console.log("✅ Hetzner API test completed successfully!");
}

main().catch((error) => {
  console.error("❌ Test failed:", error.message);
  process.exit(1);
});
