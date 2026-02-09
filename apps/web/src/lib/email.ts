/**
 * Email notifications for BlitzClaw
 * Uses Resend for transactional emails
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "BlitzClaw <noreply@blitzclaw.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.blitzclaw.com";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured, skipping email");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Failed to send email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
}

/**
 * Send low balance warning at $5
 */
export async function sendLowBalanceWarning(email: string, balanceCents: number): Promise<boolean> {
  const balanceDollars = (balanceCents / 100).toFixed(2);
  
  return sendEmail({
    to: email,
    subject: "BlitzClaw: Your balance is below $5",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #f59e0b;">⚠️ Low Balance Warning</h2>
        <p>Your BlitzClaw balance is now <strong>$${balanceDollars}</strong>.</p>
        <p>To avoid interruption to your AI assistant, please top up your account soon.</p>
        <p style="margin: 24px 0;">
          <a href="${APP_URL}/dashboard/billing" 
             style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Top Up Now
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          When your balance drops below $1, we'll automatically switch to a more economical model (Haiku) to stretch your remaining credits.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">
          <a href="${APP_URL}/dashboard/settings" style="color: #999;">Manage notifications</a> · 
          <a href="${APP_URL}" style="color: #999;">BlitzClaw</a>
        </p>
      </div>
    `,
  });
}

/**
 * Send critical balance warning at $1 (model downgrade notice)
 */
export async function sendCriticalBalanceWarning(email: string, balanceCents: number): Promise<boolean> {
  const balanceDollars = (balanceCents / 100).toFixed(2);
  
  return sendEmail({
    to: email,
    subject: "BlitzClaw: Balance below $1 — Switching to Haiku",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #ef4444;">🔴 Critical Balance</h2>
        <p>Your BlitzClaw balance is now <strong>$${balanceDollars}</strong>.</p>
        <p><strong>To preserve your remaining credits, we've automatically switched your assistant to Claude Haiku</strong> — a faster, more economical model.</p>
        <p>Your assistant will continue working, just with Haiku instead of your selected model.</p>
        <p style="margin: 24px 0;">
          <a href="${APP_URL}/dashboard/billing" 
             style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Top Up to Restore Full Model
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Once you top up above $1, your assistant will automatically switch back to your preferred model.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">
          <a href="${APP_URL}/dashboard/settings" style="color: #999;">Manage notifications</a> · 
          <a href="${APP_URL}" style="color: #999;">BlitzClaw</a>
        </p>
      </div>
    `,
  });
}

/**
 * Send instance ready notification
 */
export async function sendInstanceReadyEmail(
  email: string, 
  botUsername: string
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: "🚀 Your BlitzClaw assistant is ready!",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #22c55e;">✅ Your AI Assistant is Live!</h2>
        <p>Great news! Your BlitzClaw instance is now running and ready to chat.</p>
        <p style="margin: 24px 0; padding: 16px; background: #f0fdf4; border-radius: 8px;">
          <strong>Start chatting:</strong> Open Telegram and message <a href="https://t.me/${botUsername}" style="color: #2563eb; font-weight: 600;">@${botUsername}</a>
        </p>
        <p>Your assistant is powered by Claude and ready to help with:</p>
        <ul style="color: #666;">
          <li>Questions and research</li>
          <li>Writing and editing</li>
          <li>Code help and debugging</li>
          <li>Daily planning and reminders</li>
        </ul>
        <p style="margin: 24px 0;">
          <a href="${APP_URL}/dashboard" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            View Dashboard
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">
          <a href="${APP_URL}/dashboard/billing" style="color: #999;">Manage billing</a> · 
          <a href="${APP_URL}" style="color: #999;">BlitzClaw</a>
        </p>
      </div>
    `,
  });
}

/**
 * Send balance depleted notification
 */
export async function sendBalanceDepletedNotice(email: string): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: "BlitzClaw: Your balance is empty",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #ef4444;">❌ Balance Empty</h2>
        <p>Your BlitzClaw balance has reached $0.</p>
        <p><strong>Your AI assistant is currently paused.</strong> Top up your account to resume.</p>
        <p style="margin: 24px 0;">
          <a href="${APP_URL}/dashboard/billing" 
             style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Top Up Now
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">
          <a href="${APP_URL}/dashboard/settings" style="color: #999;">Manage notifications</a> · 
          <a href="${APP_URL}" style="color: #999;">BlitzClaw</a>
        </p>
      </div>
    `,
  });
}
