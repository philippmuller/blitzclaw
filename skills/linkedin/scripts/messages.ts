/**
 * LinkedIn Messages Script
 * Read and reply to LinkedIn DMs
 */

import { login, logout } from './login';

interface Message {
  senderName: string;
  senderUrl: string;
  preview: string;
  isUnread: boolean;
  conversationUrl: string;
}

interface ReadMessagesResult {
  success: boolean;
  messages?: Message[];
  error?: string;
}

interface SendMessageResult {
  success: boolean;
  error?: string;
}

interface ReadOptions {
  email: string;
  password: string;
  twoFactorCode?: string;
  limit?: number;
}

interface SendOptions {
  email: string;
  password: string;
  recipientUrl: string;
  message: string;
  twoFactorCode?: string;
}

export async function readMessages(options: ReadOptions): Promise<ReadMessagesResult> {
  const { email, password, twoFactorCode, limit = 10 } = options;

  let browser, page;

  try {
    const session = await login({ email, password, twoFactorCode });
    browser = session.browser;
    page = session.page;

    // Navigate to messages
    await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Get conversation list
    const conversations = await page.$$('li.msg-conversation-listitem');
    const messages: Message[] = [];

    for (let i = 0; i < Math.min(conversations.length, limit); i++) {
      const conv = conversations[i];

      try {
        const nameEl = await conv.$('.msg-conversation-listitem__participant-names');
        const previewEl = await conv.$('.msg-conversation-card__message-snippet');
        const linkEl = await conv.$('a');
        const unreadIndicator = await conv.$('.msg-conversation-card__unread-count');

        const senderName = nameEl ? await nameEl.textContent() : 'Unknown';
        const preview = previewEl ? await previewEl.textContent() : '';
        const href = linkEl ? await linkEl.getAttribute('href') : '';
        const isUnread = unreadIndicator !== null;

        messages.push({
          senderName: senderName?.trim() || 'Unknown',
          senderUrl: '',
          preview: preview?.trim() || '',
          isUnread,
          conversationUrl: href ? `https://www.linkedin.com${href}` : '',
        });
      } catch (e) {
        // Skip malformed conversations
        continue;
      }
    }

    console.log(`✅ Retrieved ${messages.length} conversations`);
    return { success: true, messages };

  } catch (error) {
    console.error('❌ Failed to read messages:', (error as Error).message);
    return { success: false, error: (error as Error).message };

  } finally {
    if (browser && page) {
      await logout(page, browser);
    }
  }
}

export async function sendMessage(options: SendOptions): Promise<SendMessageResult> {
  const { email, password, recipientUrl, message, twoFactorCode } = options;

  let browser, page;

  try {
    const session = await login({ email, password, twoFactorCode });
    browser = session.browser;
    page = session.page;

    // Navigate to the conversation or profile
    if (recipientUrl.includes('/messaging/')) {
      await page.goto(recipientUrl, { waitUntil: 'networkidle' });
    } else {
      // Navigate to profile and click Message button
      await page.goto(recipientUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const messageButton = await page.$('button:has-text("Message")');
      if (!messageButton) {
        throw new Error('Could not find Message button on profile');
      }
      await messageButton.click();
      await page.waitForTimeout(2000);
    }

    // Find message input
    const messageInput = await page.waitForSelector('.msg-form__contenteditable', { timeout: 10000 });
    if (!messageInput) {
      throw new Error('Could not find message input');
    }

    // Type the message
    await messageInput.click();
    await page.keyboard.type(message, { delay: 30 });
    await page.waitForTimeout(500);

    // Click send button
    const sendButton = await page.$('button.msg-form__send-button');
    if (!sendButton) {
      throw new Error('Could not find send button');
    }
    await sendButton.click();
    await page.waitForTimeout(2000);

    console.log('✅ Message sent successfully');
    return { success: true };

  } catch (error) {
    console.error('❌ Failed to send message:', (error as Error).message);
    return { success: false, error: (error as Error).message };

  } finally {
    if (browser && page) {
      await logout(page, browser);
    }
  }
}

// CLI usage
if (require.main === module) {
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;
  const action = process.argv[2];

  if (!email || !password) {
    console.error('Missing LINKEDIN_EMAIL or LINKEDIN_PASSWORD environment variables');
    process.exit(1);
  }

  if (action === '--read') {
    readMessages({ email, password })
      .then((result) => {
        if (result.success) {
          console.log('\nMessages:');
          result.messages?.forEach((m, i) => {
            const unread = m.isUnread ? '🔵' : '  ';
            console.log(`${unread} ${i + 1}. ${m.senderName}: ${m.preview.slice(0, 50)}...`);
          });
        } else {
          console.error('Error:', result.error);
          process.exit(1);
        }
      });
  } else if (action === '--send') {
    const recipientUrl = process.argv[3];
    const message = process.argv[4];

    if (!recipientUrl || !message) {
      console.error('Usage: npx ts-node messages.ts --send <profile_url> "message"');
      process.exit(1);
    }

    sendMessage({ email, password, recipientUrl, message })
      .then((result) => {
        if (!result.success) {
          console.error('Error:', result.error);
          process.exit(1);
        }
      });
  } else {
    console.error('Usage:');
    console.error('  npx ts-node messages.ts --read');
    console.error('  npx ts-node messages.ts --send <profile_url> "message"');
    process.exit(1);
  }
}
