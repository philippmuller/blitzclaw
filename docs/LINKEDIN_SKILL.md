# LinkedIn Automation

Automate your LinkedIn presence directly from Telegram. Post updates, reply to messages, and engage with your network — all through your BlitzClaw assistant.

## Quick Start

### 1. Add Your LinkedIn Credentials

Go to your [BlitzClaw Dashboard](https://blitzclaw.com/dashboard/secrets) and add two secrets:

| Secret Name | Value |
|-------------|-------|
| `LINKEDIN_EMAIL` | Your LinkedIn login email |
| `LINKEDIN_PASSWORD` | Your LinkedIn password |

Your credentials are encrypted and stored securely on your instance.

### 2. Start Using LinkedIn Commands

Just message your assistant:

```
"Post to LinkedIn: Just shipped a new feature! 🚀 #startup"
```

That's it! Your assistant handles the rest.

---

## What You Can Do

### 📝 Post Content

**You:** Post to LinkedIn: Excited to announce we just closed our seed round!

**Assistant:** I'll post that to LinkedIn for you...
✅ Posted! View it here: linkedin.com/feed/update/...

### 💬 Check & Reply to Messages

**You:** Check my LinkedIn DMs

**Assistant:** You have 3 unread messages:
1. 🔵 John Smith: "Hey, loved your recent post about..."
2. 🔵 Jane Doe: "Are you free for a call next week?"
3. Sarah Connor: "Thanks for connecting!"

**You:** Reply to John: Thanks! Would love to chat more. Here's my calendar: cal.com/you

**Assistant:** Draft reply to John Smith:
> "Thanks! Would love to chat more. Here's my calendar: cal.com/you"

Send this? (yes/no)

**You:** yes

**Assistant:** ✅ Message sent to John Smith

### 🤝 Send Connection Requests

**You:** Connect with https://linkedin.com/in/someone with note "Great meeting you at the conference!"

**Assistant:** ✅ Connection request sent to [Name] with your note.

### 👀 Read Your Feed

**You:** What's happening on my LinkedIn feed?

**Assistant:** Here's your feed summary:
1. **Sarah Kim** shared an article about AI trends
2. **TechCrunch** posted about the latest funding rounds
3. **Your post** from yesterday has 47 likes and 12 comments

**You:** Like Sarah's post

**Assistant:** ✅ Liked Sarah Kim's post about AI trends

---

## Two-Factor Authentication (2FA)

If you have 2FA enabled on LinkedIn, your assistant will ask for the code:

**Assistant:** LinkedIn is asking for a verification code. Please check your authenticator app and send me the 6-digit code.

**You:** 847291

**Assistant:** ✅ Verified! Continuing with your request...

---

## Rate Limits

To keep your account safe, we limit how often actions can be performed:

| Action | Daily Limit | Why |
|--------|-------------|-----|
| Posts | 3 per day | LinkedIn flags excessive posting |
| Messages | 20 per day | Avoid spam detection |
| Connection requests | 10 per day | LinkedIn limits these heavily |
| Likes | 50 per day | Stay under the radar |

Your assistant tracks these automatically and will let you know if you're approaching a limit.

---

## Security & Privacy

- ✅ **Encrypted credentials** — stored securely on your dedicated instance
- ✅ **No credential logging** — we never log your password
- ✅ **Fresh sessions** — each action uses a new browser session
- ✅ **Your instance only** — credentials are never shared across users

---

## FAQ

### Is this against LinkedIn's Terms of Service?

Yes, automation violates LinkedIn's ToS. Using this feature may result in account restrictions. Use responsibly and at your own risk.

### Can I schedule posts?

Coming soon! For now, you can ask your assistant to remind you to post at specific times.

### What if LinkedIn shows a CAPTCHA?

Your assistant will send you a screenshot and ask you to solve it. This is rare but can happen with new accounts or unusual activity.

### How do I disable LinkedIn automation?

Remove the `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD` secrets from your dashboard. Without credentials, the feature won't work.

---

## Need Help?

Message your assistant: "How do I use LinkedIn automation?"

Or contact us: support@blitzclaw.com
