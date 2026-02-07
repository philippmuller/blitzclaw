import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { 
  validateTelegramToken, 
  createTelegramConfig,
  TelegramError,
  getBotLink 
} from "@/lib/telegram";

/**
 * POST /api/instances/[id]/telegram/connect
 * 
 * Connect a Telegram bot to an instance.
 * Validates the bot token and stores the config.
 */
export async function POST(
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
  
  // Parse request body
  let body: { bot_token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { bot_token } = body;
  
  if (!bot_token || typeof bot_token !== "string") {
    return NextResponse.json(
      { error: "bot_token is required" },
      { status: 400 }
    );
  }

  // Find the instance and verify ownership
  const instance = await prisma.instance.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  // Validate the Telegram token
  let botInfo;
  try {
    botInfo = await validateTelegramToken(bot_token);
  } catch (error) {
    if (error instanceof TelegramError) {
      return NextResponse.json(
        { 
          error: error.message, 
          code: error.code,
          telegram_error_code: error.telegramErrorCode 
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to validate token" },
      { status: 500 }
    );
  }

  // Create channel config
  const channelConfig = createTelegramConfig(botInfo, bot_token);

  // Update instance
  await prisma.instance.update({
    where: { id },
    data: {
      channelType: "TELEGRAM",
      channelConfig,
    },
  });

  return NextResponse.json({
    success: true,
    message: "Telegram bot connected successfully",
    bot: {
      id: botInfo.bot_id,
      username: botInfo.bot_username,
      name: botInfo.bot_name,
      link: getBotLink(botInfo.bot_username),
    },
  });
}
