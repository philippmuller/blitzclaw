import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { parseTelegramConfig, getBotLink } from "@/lib/telegram";

/**
 * GET /api/instances/[id]/telegram/info
 * 
 * Get connected Telegram bot info for an instance.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  
  // Find the instance and verify ownership
  const instance = await prisma.instance.findFirst({
    where: {
      id,
      userId: user.id,
    },
    select: {
      id: true,
      channelType: true,
      channelConfig: true,
      status: true,
    },
  });

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  if (instance.channelType !== "TELEGRAM") {
    return NextResponse.json(
      { error: "Instance is not configured for Telegram" },
      { status: 400 }
    );
  }

  const telegramConfig = parseTelegramConfig(instance.channelConfig);
  
  if (!telegramConfig || !telegramConfig.bot_username) {
    return NextResponse.json(
      { error: "No Telegram bot connected to this instance" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    connected: true,
    bot: {
      id: telegramConfig.bot_id,
      username: telegramConfig.bot_username,
      name: telegramConfig.bot_name,
      link: getBotLink(telegramConfig.bot_username),
    },
    instance_status: instance.status,
  });
}
