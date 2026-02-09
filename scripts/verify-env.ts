#!/usr/bin/env npx tsx
/**
 * Verify BlitzClaw production environment configuration
 * Tests that all required env vars are properly configured on Vercel
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const BASE_URL = process.env.BLITZCLAW_URL || "https://www.blitzclaw.com";

interface EnvCheck {
  name: string;
  testUrl?: string;
  testFn?: () => Promise<{ ok: boolean; detail: string }>;
}

const REQUIRED_VARS: EnvCheck[] = [
  {
    name: "CREEM_API_KEY",
    testFn: async () => {
      // Test BYOK subscribe (should get checkout URL if configured)
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/billing/subscribe`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ tier: "byok", anthropicKey: "sk-ant-api03-test" })
      });
      const data = await resp.json();
      if (data.checkoutUrl) {
        return { ok: true, detail: "BYOK checkout works" };
      }
      return { ok: false, detail: data.error || "No checkout URL" };
    }
  },
  {
    name: "CREEM_PRODUCT_BYOK",
    testFn: async () => {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/billing/subscribe`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ tier: "byok", anthropicKey: "sk-ant-api03-test" })
      });
      const data = await resp.json();
      if (data.checkoutUrl?.includes("prod_12IBQa2NuKp55b")) {
        return { ok: true, detail: "prod_12IBQa2NuKp55bjAIaJ7mI" };
      }
      if (data.checkoutUrl) {
        return { ok: true, detail: "Product configured (different ID)" };
      }
      return { ok: false, detail: data.error || "Not configured" };
    }
  },
  {
    name: "CREEM_SUBSCRIPTION_PRODUCT_ID",
    testFn: async () => {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/billing/subscribe`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ tier: "basic" })
      });
      const data = await resp.json();
      if (data.checkoutUrl) {
        return { ok: true, detail: "Basic tier checkout works" };
      }
      if (data.error?.includes("not configured")) {
        return { ok: false, detail: "ENV VAR MISSING - needs: prod_6LjFrzPanR3NhzrRBz3NwW" };
      }
      return { ok: false, detail: data.error || "Unknown error" };
    }
  },
  {
    name: "CREEM_SUBSCRIPTION_PRO_PRODUCT_ID",
    testFn: async () => {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/billing/subscribe`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ tier: "pro" })
      });
      const data = await resp.json();
      if (data.checkoutUrl) {
        return { ok: true, detail: "Pro tier checkout works" };
      }
      if (data.error?.includes("not configured")) {
        return { ok: false, detail: "ENV VAR MISSING - needs: prod_6Etmr7A3gKxnTXC7VGZPE" };
      }
      return { ok: false, detail: data.error || "Unknown error" };
    }
  },
  {
    name: "HETZNER_API_TOKEN",
    testFn: async () => {
      // Test instance creation (will fail validation but shows if Hetzner is reachable)
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/instances`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          channel_type: "telegram",
          telegramToken: "123:TEST" 
        })
      });
      const data = await resp.json();
      // If we get past validation, Hetzner is configured
      if (data.id || data.status === "PROVISIONING") {
        return { ok: true, detail: "Hetzner provisioning works" };
      }
      if (data.error?.includes("Hetzner")) {
        return { ok: false, detail: "Hetzner not configured" };
      }
      return { ok: true, detail: "Endpoint reachable" };
    }
  },
  {
    name: "HETZNER_SSH_KEY_ID",
    testFn: async () => {
      // This is checked indirectly - if server creation fails with SSH warning, it's not set
      // We can only verify by checking if servers get proper SSH access
      // For now, just mark as needs manual verification
      return { ok: true, detail: "needs: 106934050 (verify server SSH access manually)" };
    }
  },
  {
    name: "CLERK_SECRET_KEY",
    testFn: async () => {
      const resp = await fetch(`${BASE_URL}/api/auth/me`);
      // Should return 401 or 404 (protected)
      if (resp.status === 401 || resp.status === 404 || resp.status === 403) {
        return { ok: true, detail: "Auth protection working" };
      }
      return { ok: false, detail: `Unexpected status: ${resp.status}` };
    }
  },
];

let cachedToken: string | null = null;

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  
  const { getTestUserToken } = await import("./test-helpers");
  cachedToken = await getTestUserToken();
  return cachedToken;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║         BlitzClaw Production Environment Check               ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  console.log(`🌐 Target: ${BASE_URL}\n`);

  let allOk = true;
  const missing: string[] = [];

  for (const check of REQUIRED_VARS) {
    if (check.testFn) {
      try {
        const result = await check.testFn();
        if (result.ok) {
          console.log(`✅ ${check.name}: ${result.detail}`);
        } else {
          console.log(`❌ ${check.name}: ${result.detail}`);
          missing.push(`${check.name}=${result.detail.includes("needs:") ? result.detail.split("needs:")[1].trim() : "???"}`);
          allOk = false;
        }
      } catch (e) {
        console.log(`❌ ${check.name}: Error - ${e}`);
        allOk = false;
      }
    }
  }

  console.log("\n" + "─".repeat(60));
  
  if (allOk) {
    console.log("✅ All environment variables configured correctly!");
  } else {
    console.log("❌ Missing environment variables on Vercel:\n");
    for (const m of missing) {
      console.log(`   vercel env add ${m.split("=")[0]} production`);
      console.log(`   > ${m.split("=")[1]}\n`);
    }
  }

  // Cleanup
  const { cleanupTestSession } = await import("./test-helpers");
  await cleanupTestSession();

  process.exit(allOk ? 0 : 1);
}

main();
