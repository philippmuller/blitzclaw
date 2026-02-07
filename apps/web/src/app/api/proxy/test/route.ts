/**
 * Proxy Test Endpoint (Development Only)
 * 
 * Allows testing the proxy flow without an instance:
 * - Creates a test instance if needed
 * - Makes a test request through the proxy
 * - Returns detailed debug info
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, InstanceStatus, ChannelType } from "@blitzclaw/db";
import { calculateCost, getModelPricing, getSupportedModels } from "@/lib/pricing";

/**
 * GET /api/proxy/test - Get proxy info and test credentials
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  // Get or create a test user
  let testUser = await prisma.user.findFirst({
    where: { email: "test@blitzclaw.local" },
    include: { balance: true, instances: true },
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        clerkId: "test_clerk_id",
        email: "test@blitzclaw.local",
        balance: {
          create: {
            creditsCents: 5000, // $50 test balance
          },
        },
      },
      include: { balance: true, instances: true },
    });
  }

  // Get or create a test instance
  let testInstance = testUser.instances.find(i => i.personaTemplate === "test");
  
  if (!testInstance) {
    testInstance = await prisma.instance.create({
      data: {
        userId: testUser.id,
        channelType: ChannelType.TELEGRAM,
        personaTemplate: "test",
        status: InstanceStatus.ACTIVE,
        soulMd: "# Test Instance\n\nThis is a test instance for proxy development.",
      },
    });
  }

  return NextResponse.json({
    message: "BlitzClaw Token Proxy - Test Mode",
    testCredentials: {
      instanceId: testInstance.id,
      secret: process.env.PROXY_SIGNING_SECRET,
    },
    user: {
      id: testUser.id,
      email: testUser.email,
      balanceCents: testUser.balance?.creditsCents ?? 0,
    },
    instance: {
      id: testInstance.id,
      status: testInstance.status,
    },
    supportedModels: getSupportedModels(),
    curlExample: `curl -X POST ${process.env.NEXT_PUBLIC_APP_URL}/api/proxy/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "X-BlitzClaw-Instance: ${testInstance.id}" \\
  -H "X-BlitzClaw-Secret: ${process.env.PROXY_SIGNING_SECRET}" \\
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
  });
}

/**
 * POST /api/proxy/test - Calculate cost for a hypothetical request
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const body = await req.json();
  const { model, input_tokens, output_tokens } = body;

  if (!model || input_tokens === undefined || output_tokens === undefined) {
    return NextResponse.json({
      error: "Missing required fields",
      required: ["model", "input_tokens", "output_tokens"],
    }, { status: 400 });
  }

  const pricing = getModelPricing(model);
  if (!pricing) {
    return NextResponse.json({
      error: "Unknown model",
      supportedModels: getSupportedModels().map(m => m.model),
    }, { status: 400 });
  }

  const cost = calculateCost(model, input_tokens, output_tokens);

  return NextResponse.json({
    model,
    input_tokens,
    output_tokens,
    pricing: {
      inputPer1M_cents: pricing.inputPer1M,
      outputPer1M_cents: pricing.outputPer1M,
    },
    calculated: cost ? {
      costCents: cost.costCents,
      costDollars: (cost.costCents / 100).toFixed(4),
    } : null,
  });
}
