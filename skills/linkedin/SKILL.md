---
name: linkedin
description: Automate LinkedIn - post content, reply to DMs, send connection requests, engage with feed. Uses headless browser with stored credentials.
metadata:
  openclaw:
    emoji: "💼"
    requires:
      secrets: ["LINKEDIN_EMAIL", "LINKEDIN_PASSWORD"]
      bins: ["npx"]
---

# LinkedIn Automation Skill

Automate your LinkedIn presence directly from chat. Post updates, reply to messages, send connection requests, and engage with your network.

## Prerequisites

### 1. Store LinkedIn Credentials

User must add credentials via the BlitzClaw dashboard:

1. Go to **Dashboard → Secrets**
2. Add two secrets:
   - `LINKEDIN_EMAIL` — your LinkedIn login email
   - `LINKEDIN_PASSWORD` — your LinkedIn password

**Security note:** Credentials are encrypted at rest and only accessible by your agent instance.

### 2. Two-Factor Authentication (2FA)

If you have 2FA enabled on LinkedIn:
- The agent will ask you for the verification code via chat
- You have ~60 seconds to provide it
- Consider using an app-based 2FA for faster entry

## Capabilities

### 📝 Post Content

```
User: "Post to LinkedIn: Just shipped our new feature! 🚀 #startup #tech"

Agent: 
- Logs into LinkedIn
- Creates the post
- Returns: "✅ Posted to LinkedIn: [link to post]"
```

**Supported post types:**
- Text posts
- Text with hashtags
- Polls (coming soon)

### 💬 Reply to DMs

```
User: "Check my LinkedIn DMs"

Agent:
- Logs into LinkedIn
- Reads unread messages
- Summarizes: "You have 3 unread messages:
  1. John Smith: 'Hey, saw your post about...'
  2. Jane Doe: 'Are you available for a call?'
  3. ..."

User: "Reply to John: Thanks! Happy to chat more. Send him my calendar link."

Agent:
- Drafts reply
- Shows preview: "Draft reply to John: 'Thanks! Happy to chat more. Here's my calendar: [link]'"
- Asks: "Send this? (yes/no)"
- On approval, sends the message
```

### 🤝 Connection Requests

```
User: "Send a connection request to https://linkedin.com/in/someone with note: 'Great meeting you at the conference!'"

Agent:
- Navigates to profile
- Sends connection request with note
- Returns: "✅ Connection request sent to [name]"
```

### 👀 Read Feed & Engage

```
User: "Show me my LinkedIn feed"

Agent:
- Scrolls through recent posts
- Summarizes top 5-10 posts
- Returns digest with options to like/comment

User: "Like the post from Sarah about AI trends"

Agent:
- Finds the post
- Likes it
- Returns: "✅ Liked Sarah's post"
```

## Usage Patterns

### Quick Post
```
"Post to LinkedIn: [your content]"
"Share on LinkedIn: [content]"
```

### Check Messages
```
"Check my LinkedIn messages"
"Any new LinkedIn DMs?"
"Read my LinkedIn inbox"
```

### Reply to Messages
```
"Reply to [name] on LinkedIn: [message]"
"Send LinkedIn message to [name]: [message]"
```

### Connections
```
"Send connection request to [URL or name]"
"Connect with [name] on LinkedIn"
```

### Feed
```
"Show my LinkedIn feed"
"What's happening on LinkedIn?"
"Like [name]'s recent post"
"Comment on [name]'s post: [comment]"
```

## Rate Limits & Safety

To avoid LinkedIn detecting automation and flagging your account:

| Action | Limit | Cooldown |
|--------|-------|----------|
| Posts | 3/day | 4 hours between posts |
| DM replies | 20/day | 30 sec between messages |
| Connection requests | 10/day | 5 min between requests |
| Likes | 50/day | 10 sec between likes |
| Comments | 10/day | 2 min between comments |

**The agent enforces these limits automatically.** If you hit a limit, it will tell you when you can try again.

## How It Works (Technical)

1. Agent reads `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD` from secrets
2. Launches headless Chromium via Playwright
3. Logs into LinkedIn (handles 2FA if needed)
4. Performs requested action
5. Logs out and closes browser
6. Reports result

**Session handling:**
- Each action is a fresh login/logout cycle
- No persistent cookies stored (reduces detection risk)
- Browser runs in headless mode on your instance

## Running the Scripts Manually

If you need to debug or run scripts directly:

```bash
# Post to LinkedIn
npx ts-node /opt/blitzclaw/skills/linkedin/scripts/post.ts "Your post content"

# Check DMs
npx ts-node /opt/blitzclaw/skills/linkedin/scripts/messages.ts --read

# Send connection request  
npx ts-node /opt/blitzclaw/skills/linkedin/scripts/connect.ts "https://linkedin.com/in/username" "Optional note"
```

## Limitations

- **2FA required:** You must provide verification codes via chat
- **Visual CAPTCHA:** If LinkedIn shows a CAPTCHA, agent will ask you to solve it (screenshot provided)
- **Rate limits:** LinkedIn may temporarily restrict actions if limits exceeded
- **Account risk:** Automation violates LinkedIn ToS — use at your own risk
- **No image posts:** Text-only posts for now (image upload coming later)

## Troubleshooting

### "Login failed"
- Check credentials in Dashboard → Secrets
- LinkedIn may have triggered a security check — log in manually once

### "Action blocked"
- You've hit LinkedIn's rate limits
- Wait 24 hours before trying again

### "2FA timeout"
- Provide the code faster (within 60 seconds)
- Consider disabling 2FA or using app-based auth

### "Element not found"
- LinkedIn updated their UI — report to support@blitzclaw.com

## Privacy & Security

- Credentials are encrypted at rest
- No credentials are logged or transmitted outside your instance
- Browser sessions are destroyed after each use
- You can revoke access anytime by removing secrets from dashboard

---

**⚠️ Disclaimer:** LinkedIn automation violates LinkedIn's Terms of Service. Using this skill may result in account restrictions or bans. BlitzClaw is not responsible for any consequences to your LinkedIn account. Use responsibly and at your own risk.
