/**
 * Telegram Bot API integration for BlitzClaw
 * 
 * Handles bot token validation and basic bot info retrieval.
 */

export interface TelegramBotInfo {
  bot_id: string;
  bot_username: string;
  bot_name: string;
}

export interface TelegramApiResponse {
  ok: boolean;
  result?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
    supports_inline_queries?: boolean;
  };
  error_code?: number;
  description?: string;
}

/**
 * Validate a Telegram bot token by calling getMe endpoint
 * 
 * @param token - The bot token from BotFather
 * @returns Bot info if valid
 * @throws Error if token is invalid or API call fails
 */
export async function validateTelegramToken(token: string): Promise<TelegramBotInfo> {
  // Basic format validation
  if (!token || typeof token !== "string") {
    throw new TelegramError("Bot token is required", "INVALID_TOKEN");
  }
  
  // Token format: <bot_id>:<secret>
  // e.g., 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
  const tokenPattern = /^\d+:[A-Za-z0-9_-]{35,}$/;
  if (!tokenPattern.test(token.trim())) {
    throw new TelegramError(
      "Invalid token format. Get your token from @BotFather on Telegram.",
      "INVALID_FORMAT"
    );
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    const data = await response.json() as TelegramApiResponse;

    if (!data.ok || !data.result) {
      const message = data.description || "Invalid bot token";
      throw new TelegramError(message, "API_ERROR", data.error_code);
    }

    if (!data.result.is_bot) {
      throw new TelegramError("Token does not belong to a bot", "NOT_A_BOT");
    }

    return {
      bot_id: String(data.result.id),
      bot_username: data.result.username,
      bot_name: data.result.first_name,
    };
  } catch (error) {
    if (error instanceof TelegramError) {
      throw error;
    }
    
    // Network or other errors
    throw new TelegramError(
      `Failed to connect to Telegram API: ${(error as Error).message}`,
      "NETWORK_ERROR"
    );
  }
}

/**
 * Get the Telegram bot link for starting a chat
 */
export function getBotLink(username: string): string {
  return `https://t.me/${username}`;
}

/**
 * Custom error class for Telegram-related errors
 */
export class TelegramError extends Error {
  constructor(
    message: string,
    public code: string,
    public telegramErrorCode?: number
  ) {
    super(message);
    this.name = "TelegramError";
  }
}

/**
 * Parse channel config JSON and extract Telegram info
 */
export function parseTelegramConfig(channelConfig: string | null): {
  bot_token?: string;
  bot_id?: string;
  bot_username?: string;
  bot_name?: string;
} | null {
  if (!channelConfig) return null;
  
  try {
    const config = JSON.parse(channelConfig);
    return config.telegram || null;
  } catch {
    return null;
  }
}

/**
 * Create channel config JSON for Telegram
 */
export function createTelegramConfig(botInfo: TelegramBotInfo, botToken: string): string {
  return JSON.stringify({
    telegram: {
      bot_token: botToken,
      bot_id: botInfo.bot_id,
      bot_username: botInfo.bot_username,
      bot_name: botInfo.bot_name,
      connected_at: new Date().toISOString(),
    },
  });
}
