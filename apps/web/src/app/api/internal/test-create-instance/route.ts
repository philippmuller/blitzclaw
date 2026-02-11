/**
 * Test endpoint to create an instance without going through UI
 * FOR TESTING ONLY - protected by debug key
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { createInstance } from "@/lib/provisioning";

const DEBUG_KEY = process.env.DIAGNOSTICS_KEY || "blitz-debug-2026";

export async function POST(req: NextRequest) {
  const debugKey = req.nextUrl.searchParams.get("key");
  
  if (debugKey !== DEBUG_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { userId, telegramToken, telegramBotUsername, byokMode, anthropicKey } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (!telegramToken) {
    return NextResponse.json({ error: "telegramToken required" }, { status: 400 });
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { balance: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check balance
  const balance = user.balance?.creditsCents ?? 0;
  if (balance < 100) {
    return NextResponse.json({ 
      error: "Insufficient balance",
      balance,
      required: 100,
    }, { status: 402 });
  }

  console.log("🧪 Test instance creation for user:", {
    userId: user.id,
    email: user.email,
    balance,
  });

  try {
    const startTime = Date.now();
    
    // Update user's billing mode if BYOK
    if (byokMode && anthropicKey) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          billingMode: "byok",
          anthropicKey,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          billingMode: "managed",
          anthropicKey: null,
        },
      });
    }
    
    const result = await createInstance({
      userId: user.id,
      channelType: "TELEGRAM",
      personaTemplate: "assistant",
      model: "claude-sonnet-4-5", // Use sonnet for test (cheaper)
      channelConfig: JSON.stringify({
        bot_token: telegramToken,
        botUsername: telegramBotUsername || "test_bot",
      }),
      byokMode: byokMode || false,
      anthropicKey: byokMode ? anthropicKey : undefined,
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      instance: result,
      duration: `${duration}ms`,
      user: {
        id: user.id,
        email: user.email?.slice(0, 15) + "...",
      },
    });
  } catch (error) {
    console.error("Test instance creation failed:", error);
    return NextResponse.json({
      error: "Instance creation failed",
      details: (error as Error).message,
      stack: (error as Error).stack?.slice(0, 500),
    }, { status: 500 });
  }
}
