import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { createInstance, listInstances } from "@/lib/provisioning";

// Minimum balance required to create an instance (in cents)
const MINIMUM_BALANCE_CENTS = 1000;

/**
 * GET /api/instances - List user's instances
 */
export async function GET() {
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const instances = await listInstances(user.id);

  return NextResponse.json({
    instances: instances.map(instance => ({
      id: instance.id,
      status: instance.status,
      channelType: instance.channelType,
      personaTemplate: instance.personaTemplate,
      ipAddress: instance.ipAddress,
      createdAt: instance.createdAt,
      lastHealthCheck: instance.lastHealthCheck,
    })),
  });
}

/**
 * POST /api/instances - Create a new instance
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { balance: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if BYOK user (no balance check required)
  const isByokUser = user.billingMode === "byok" && !!user.anthropicKey;
  
  // Check balance (skip for BYOK users)
  if (!isByokUser) {
    const balance = user.balance?.creditsCents ?? 0;
    if (balance < MINIMUM_BALANCE_CENTS) {
      return NextResponse.json(
        { 
          error: "Insufficient balance",
          message: `Minimum balance of $${MINIMUM_BALANCE_CENTS / 100} required to create an instance`,
          currentBalance: balance,
          requiredBalance: MINIMUM_BALANCE_CENTS,
        },
        { status: 402 }
      );
    }
  }

  // Parse request body
  const body = await req.json();
  const { 
    channel_type, 
    persona_template, 
    soul_md,
    model,
    // New fields from onboarding
    telegramToken,
    persona,
    autoTopup,
    anthropicKey, // For BYOK - can also use user.anthropicKey
  } = body;
  
  // Use anthropicKey from request or from user profile
  const effectiveAnthropicKey = anthropicKey || user.anthropicKey;

  // Determine channel type - default to TELEGRAM if telegramToken provided
  let channelType = channel_type?.toUpperCase();
  if (!channelType && telegramToken) {
    channelType = "TELEGRAM";
  }
  if (!channelType || !["TELEGRAM", "WHATSAPP"].includes(channelType)) {
    return NextResponse.json(
      { error: "Invalid channel_type. Must be 'telegram' or 'whatsapp'" },
      { status: 400 }
    );
  }

  // Validate persona template
  const validPersonas = ["assistant", "developer", "creative", "custom", "coder", "casual"];
  const selectedPersona = persona || persona_template || "assistant";
  if (!validPersonas.includes(selectedPersona)) {
    return NextResponse.json(
      { error: `Invalid persona. Must be one of: ${validPersonas.join(", ")}` },
      { status: 400 }
    );
  }

  // If telegram token provided, validate it
  if (channelType === "TELEGRAM" && !telegramToken && !body.channel_config) {
    return NextResponse.json(
      { error: "Telegram bot token is required" },
      { status: 400 }
    );
  }

  // Update auto-topup preference if provided
  if (autoTopup !== undefined && user.balance) {
    await prisma.balance.update({
      where: { userId: user.id },
      data: { 
        autoTopupEnabled: autoTopup,
        topupAmountCents: 2500, // €25 top-up
      },
    });
  }

  try {
    const result = await createInstance({
      userId: user.id,
      channelType: channelType as "TELEGRAM" | "WHATSAPP",
      personaTemplate: selectedPersona,
      model: model || "claude-opus-4-20250514",
      soulMd: soul_md,
      channelConfig: telegramToken ? JSON.stringify({ bot_token: telegramToken }) : body.channel_config,
      byokMode: isByokUser,
      anthropicKey: isByokUser ? effectiveAnthropicKey : undefined,
    });

    return NextResponse.json({
      id: result.instanceId,
      status: result.status,
      ipAddress: result.ipAddress,
      message: result.ipAddress 
        ? "Instance created and provisioning" 
        : "Instance created, waiting for server assignment",
    });
  } catch (error) {
    console.error("Failed to create instance:", error);
    return NextResponse.json(
      { error: "Failed to create instance", details: (error as Error).message },
      { status: 500 }
    );
  }
}
