import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'BlitzClaw <service@blitzclaw.com>';
const REPLY_TO = 'mailphilippmuller@gmail.com';

export async function sendDiscountEmail(to: string) {
  return resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: 'Your AI assistant is waiting 🦞',
    text: `Hey!

You signed up for BlitzClaw yesterday but haven't launched your AI assistant yet.

Need help? Just reply to this email — I personally read every one.

Or if you're ready: https://blitzclaw.com/dashboard

As an early adopter, use code EARLY_BIRD for 40% off your first month.

– Philipp
Founder, BlitzClaw

P.S. Takes 5 minutes to set up. Your own BlitzClaw Assistant, running 24/7.`,
  });
}

export async function sendWelcomeEmail(to: string) {
  return resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: "You're live! Here's how to get the most out of BlitzClaw",
    text: `Welcome to BlitzClaw! 🎉

Your AI assistant is now running. Here's how to make it yours:

1. Connect Telegram — Scan the QR code in your dashboard
2. Add secrets — API keys, passwords (Dashboard → Secrets)
3. Customize personality — Edit the Soul in settings

Quick wins to try:
• "Research [topic] and summarize the key points"
• "Draft an email to [person] about [topic]"
• "Summarize this article: [URL]"

Guides: https://blitzclaw.com/guides
Questions? Just reply to this email.

– Philipp`,
  });
}

export async function sendPowerUserEmail(to: string) {
  return resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: "You've been using BlitzClaw for a week — here's what's next",
    text: `You've been running your AI assistant for a week now. Nice!

Power user tips:

🔧 Sync files with Syncthing
Your assistant can read/write files on your computer.
Guide: https://blitzclaw.com/guides#syncthing

🌐 Browser automation
Let your assistant browse the web for you.
Guide: https://blitzclaw.com/guides#browser

🔑 Secrets for API access
Store API keys securely. Your assistant can use them.
Guide: https://blitzclaw.com/guides#secrets

What would make BlitzClaw better for you? Hit reply — I read everything.

– Philipp`,
  });
}
