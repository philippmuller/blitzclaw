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
import { calculateCost, DAILY_LIMIT_CENTS } from "@/lib/pricing";
// Polar handles usage-based billing - no auto-topup or balance blocking needed
import { trackUsage, calculateCredits } from "@/lib/polar";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PROXY_SIGNING_SECRET = process.env.PROXY_SIGNING_SECRET;

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
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
 * 
 * Auth: Instances send their proxySecret as the x-api-key header.
 * We look up the instance by this secret and validate.
 */
export async function POST(req: NextRequest) {
  // 1. Get the proxy token from x-api-key header (standard Anthropic header)
  const proxyToken = req.headers.get("x-api-key");

  if (!proxyToken) {
    return NextResponse.json(
      { error: "Missing x-api-key header" },
      { status: 401 }
    );
  }

  // 2. Look up instance by proxySecret (stored in Instance table)
  const instance = await prisma.instance.findUnique({
    where: { proxySecret: proxyToken },
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

  // 3. Daily spend limit (safety cap) - Polar handles actual billing
  // No balance blocking since Polar meters usage and bills overages
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayUsage = await prisma.usageLog.aggregate({
    where: {
      instance: { userId: instance.userId },
      timestamp: { gte: todayStart },
    },
    _sum: { costCents: true },
  });
  
  const todaySpendCents = todayUsage._sum.costCents ?? 0;
  
  if (todaySpendCents >= DAILY_LIMIT_CENTS) {
    return NextResponse.json(
      {
        error: "Daily limit reached",
        code: "DAILY_LIMIT_EXCEEDED",
        message: `Daily spend limit of $${DAILY_LIMIT_CENTS / 100} reached. Limit resets at midnight.`,
        todaySpend: todaySpendCents,
        dailyLimit: DAILY_LIMIT_CENTS,
      },
      { status: 429 }
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

  // Use model from instance settings (allows dashboard override)
  const model = instance.model || requestBody.model || "claude-opus-4-6";
  
  // Override the model in the request to Anthropic
  requestBody.model = model;
  const isStreaming = requestBody.stream === true;

  // 5. Check if ANTHROPIC_API_KEY is configured
  if (!ANTHROPIC_API_KEY) {
    // For testing without a real key, return a mock response
    if (process.env.NODE_ENV === "development") {
      return mockAnthropicResponse(model, instance.id);
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

  // 6b. Handle streaming responses - parse SSE for actual usage
  if (isStreaming && anthropicResponse.body) {
    const decoder = new TextDecoder();
    
    // Track usage from stream events (including cache tokens)
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;
    let buffer = "";
    
    // Create a transform stream that captures usage while passing through
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        // Pass through immediately
        controller.enqueue(chunk);
        
        // Parse for usage data
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data && data !== "[DONE]") {
              try {
                const event = JSON.parse(data);
                
                // message_start contains initial input token count
                if (event.type === "message_start" && event.message?.usage) {
                  const usage = event.message.usage;
                  inputTokens = usage.input_tokens || 0;
                  cacheCreationTokens = usage.cache_creation_input_tokens || 0;
                  cacheReadTokens = usage.cache_read_input_tokens || 0;
                }
                
                // message_delta contains final output token count
                if (event.type === "message_delta" && event.usage) {
                  outputTokens = event.usage.output_tokens || 0;
                  // Also update cache tokens if present in delta
                  if (event.usage.cache_creation_input_tokens) {
                    cacheCreationTokens = event.usage.cache_creation_input_tokens;
                  }
                  if (event.usage.cache_read_input_tokens) {
                    cacheReadTokens = event.usage.cache_read_input_tokens;
                  }
                }
              } catch {
                // Ignore parse errors for partial JSON
              }
            }
          }
        }
      },
      
      async flush() {
        // Stream complete - log actual usage
        // Total input = regular + cache_creation (1.25x) + cache_read (0.1x)
        // For simplicity, we bill cache_creation as 1.25x input and cache_read as 0.1x input
        const effectiveInputTokens = inputTokens + 
          Math.ceil(cacheCreationTokens * 1.25) + 
          Math.ceil(cacheReadTokens * 0.1);
        
        if (effectiveInputTokens > 0 || outputTokens > 0) {
          const costResult = calculateCost(model, effectiveInputTokens, outputTokens);
          const costCents = costResult?.costCents ?? 1;
          
          console.log(`Streaming complete: in=${inputTokens} cache_create=${cacheCreationTokens} cache_read=${cacheReadTokens} out=${outputTokens} effective_in=${effectiveInputTokens} cost=${costCents}¢`);
          
          // Log usage and deduct balance
          try {
            await prisma.$transaction([
              prisma.usageLog.create({
                data: {
                  instanceId: instance.id,
                  model,
                  tokensIn: effectiveInputTokens, // Store effective (includes cache adjustment)
                  tokensOut: outputTokens,
                  costCents,
                },
              }),
              prisma.balance.update({
                where: { userId: instance.userId },
                data: { creditsCents: { decrement: costCents } },
              }),
            ]);
            
            // Track usage with Polar for managed billing users (not BYOK)
            if (instance.user.billingMode === "managed" && instance.user.polarCustomerId) {
              const polarCredits = calculateCredits(effectiveInputTokens, outputTokens, model);
              trackUsage(instance.user.id, polarCredits, {
                model,
                input_tokens: effectiveInputTokens,
                output_tokens: outputTokens,
                instance_id: instance.id,
              }).catch(err => console.error("Polar tracking failed:", err));
            }
          } catch (err) {
            console.error("Failed to log streaming usage:", err);
          }
        }
      },
    });
    
    // Pipe the response through our transform
    const stream = anthropicResponse.body.pipeThrough(transformStream);
    
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  // 7. Parse response for token usage (non-streaming)
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
    console.warn(`No usage data in response for instance ${instance.id}`);
    return NextResponse.json(responseData);
  }

  const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
  const cacheReadTokens = usage.cache_read_input_tokens || 0;
  const effectiveInputTokens = usage.input_tokens +
    Math.ceil(cacheCreationTokens * 1.25) +
    Math.ceil(cacheReadTokens * 0.1);

  const costResult = calculateCost(model, effectiveInputTokens, usage.output_tokens);
  if (!costResult) {
    console.warn(`Unknown model ${model}, skipping billing`);
    return NextResponse.json(responseData);
  }

  const { costCents } = costResult;

  // 9. Log usage and update balance (for tracking - Polar handles actual billing)
  try {
    await prisma.$transaction(async (tx) => {
      // Create usage log
      await tx.usageLog.create({
        data: {
          instanceId: instance.id,
          model,
          tokensIn: effectiveInputTokens,
          tokensOut: usage.output_tokens,
          costCents,
        },
      });

      // Deduct from balance (for tracking purposes - Polar handles actual billing)
      const updatedBalance = await tx.balance.update({
        where: { userId: instance.userId },
        data: {
          creditsCents: {
            decrement: costCents,
          },
        },
      });

    });
    
    // Track usage with Polar for managed billing users (not BYOK)
    if (instance.user.billingMode === "managed" && instance.user.polarCustomerId) {
      const polarCredits = calculateCredits(effectiveInputTokens, usage.output_tokens, model);
      trackUsage(instance.user.id, polarCredits, {
        model,
        input_tokens: effectiveInputTokens,
        output_tokens: usage.output_tokens,
        instance_id: instance.id,
      }).catch(err => console.error("Polar tracking failed:", err));
    }
  } catch (error) {
    // Log error but still return the response - we got the data, billing can be reconciled
    console.error(`Failed to log usage for instance ${instance.id}:`, error);
  }

  // NOTE: No auto top-up or balance blocking - Polar handles usage-based billing
  // Users are billed for overage beyond included credits at end of billing cycle

  // 11. Return response to instance
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
