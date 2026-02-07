import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { validateTelegramToken, TelegramError, getBotLink } from "@/lib/telegram";

/**
 * POST /api/telegram/validate
 * 
 * Validate a Telegram bot token without connecting it to an instance.
 * Useful for testing tokens before connecting.
 */
export async function POST(req: NextRequest) {
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

  return NextResponse.json({
    success: true,
    message: "Token is valid",
    bot: {
      id: botInfo.bot_id,
      username: botInfo.bot_username,
      name: botInfo.bot_name,
      link: getBotLink(botInfo.bot_username),
    },
  });
}
