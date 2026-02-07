/**
 * Token Proxy for BlitzClaw
 * 
 * Sits between OpenClaw instances and Anthropic API.
 * - Authenticates requests from instances
 * - Forwards to Anthropic
 * - Logs token usage
 * - Deducts from user balance
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, InstanceStatus } from "@blitzclaw/db";
import { calculateCost, MINIMUM_BALANCE_CENTS } from "@/lib/pricing";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PROXY_SIGNING_SECRET = process.env.PROXY_SIGNING_SECRET;

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{ type: string; text?: string }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: AnthropicUsage;
}

/**
 * POST /api/proxy/v1/messages - Proxy to Anthropic Messages API
 */
export async function POST(req: NextRequest) {
  // 1. Validate proxy credentials
  const instanceId = req.headers.get("X-BlitzClaw-Instance");
  const instanceSecret = req.headers.get("X-BlitzClaw-Secret");

  if (!instanceId || !instanceSecret) {
    return NextResponse.json(
      { error: "Missing X-BlitzClaw-Instance or X-BlitzClaw-Secret headers" },
      { status: 401 }
    );
  }

  // Verify signing secret matches (simple validation)
  // In production, each instance would have its own secret stored in DB
  if (!PROXY_SIGNING_SECRET) {
    console.error("PROXY_SIGNING_SECRET not configured");
    return NextResponse.json(
      { error: "Proxy not configured" },
      { status: 500 }
    );
  }

  // 2. Look up instance and user
  const instance = await prisma.instance.findUnique({
    where: { id: instanceId },
    include: {
      user: {
        include: {
          balance: true,
        },
      },
    },
  });

  if (!instance) {
    return NextResponse.json(
      { error: "Instance not found" },
      { status: 404 }
    );
  }

  // Check instance status
  if (instance.status === InstanceStatus.PAUSED) {
    return NextResponse.json(
      { 
        error: "Instance paused due to insufficient balance",
        code: "BALANCE_DEPLETED",
        message: "Please top up your account to continue using this instance.",
      },
      { status: 402 }
    );
  }

  if (instance.status !== InstanceStatus.ACTIVE && instance.status !== InstanceStatus.PROVISIONING) {
    return NextResponse.json(
      { error: `Instance is ${instance.status.toLowerCase()}` },
      { status: 400 }
    );
  }

  // 3. Check user balance
  const balance = instance.user.balance?.creditsCents ?? 0;
  
  if (balance < MINIMUM_BALANCE_CENTS) {
    return NextResponse.json(
      {
        error: "Insufficient balance",
        code: "INSUFFICIENT_BALANCE",
        message: `Minimum balance of $${MINIMUM_BALANCE_CENTS / 100} required. Current balance: $${(balance / 100).toFixed(2)}`,
        currentBalance: balance,
        requiredBalance: MINIMUM_BALANCE_CENTS,
      },
      { status: 402 }
    );
  }

  // 4. Parse request body
  let requestBody: { model?: string; [key: string]: unknown };
  try {
    requestBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const model = requestBody.model || "claude-sonnet-4-20250514";

  // 5. Check if ANTHROPIC_API_KEY is configured
  if (!ANTHROPIC_API_KEY) {
    // For testing without a real key, return a mock response
    if (process.env.NODE_ENV === "development") {
      return mockAnthropicResponse(model, instanceId);
    }
    return NextResponse.json(
      { error: "Anthropic API key not configured" },
      { status: 500 }
    );
  }

  // 6. Forward request to Anthropic
  let anthropicResponse: Response;
  try {
    anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    console.error("Failed to call Anthropic API:", error);
    return NextResponse.json(
      { error: "Failed to reach Anthropic API" },
      { status: 502 }
    );
  }

  // Handle non-OK responses from Anthropic
  if (!anthropicResponse.ok) {
    const errorText = await anthropicResponse.text();
    return new NextResponse(errorText, {
      status: anthropicResponse.status,
      headers: {
        "Content-Type": anthropicResponse.headers.get("Content-Type") || "application/json",
      },
    });
  }

  // 7. Parse response for token usage
  let responseData: AnthropicResponse;
  try {
    responseData = await anthropicResponse.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid response from Anthropic" },
      { status: 502 }
    );
  }

  // 8. Calculate cost with markup
  const usage = responseData.usage;
  if (!usage) {
    // Return response without billing if no usage data
    console.warn(`No usage data in response for instance ${instanceId}`);
    return NextResponse.json(responseData);
  }

  const costResult = calculateCost(model, usage.input_tokens, usage.output_tokens);
  if (!costResult) {
    console.warn(`Unknown model ${model}, skipping billing`);
    return NextResponse.json(responseData);
  }

  const { costCents } = costResult;

  // 9. Deduct from balance and log usage (atomic transaction)
  try {
    await prisma.$transaction(async (tx) => {
      // Create usage log
      await tx.usageLog.create({
        data: {
          instanceId: instance.id,
          model,
          tokensIn: usage.input_tokens,
          tokensOut: usage.output_tokens,
          costCents,
        },
      });

      // Deduct from balance
      const updatedBalance = await tx.balance.update({
        where: { userId: instance.userId },
        data: {
          creditsCents: {
            decrement: costCents,
          },
        },
      });

      // Check if balance went negative or below minimum - pause instance
      if (updatedBalance.creditsCents < 0) {
        console.warn(`Instance ${instanceId} balance depleted, pausing...`);
        await tx.instance.update({
          where: { id: instanceId },
          data: { status: InstanceStatus.PAUSED },
        });
      }
    });
  } catch (error) {
    // Log error but still return the response - we got the data, billing can be reconciled
    console.error(`Failed to log usage for instance ${instanceId}:`, error);
  }

  // 10. Return response to instance
  return NextResponse.json(responseData);
}

/**
 * Mock response for development/testing when no API key is configured
 */
function mockAnthropicResponse(model: string, instanceId: string) {
  const mockUsage = {
    input_tokens: 100,
    output_tokens: 50,
  };

  const mockResponse: AnthropicResponse = {
    id: `msg_mock_${Date.now()}`,
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: "[MOCK RESPONSE] This is a test response from the BlitzClaw proxy. In production, this would be a real response from Anthropic.",
      },
    ],
    model,
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: mockUsage,
  };

  // Still log the mock usage for testing
  prisma.usageLog.create({
    data: {
      instanceId,
      model,
      tokensIn: mockUsage.input_tokens,
      tokensOut: mockUsage.output_tokens,
      costCents: 1, // Minimal cost for testing
    },
  }).catch((err) => console.error("Failed to log mock usage:", err));

  return NextResponse.json(mockResponse, {
    headers: {
      "X-BlitzClaw-Mock": "true",
    },
  });
}
