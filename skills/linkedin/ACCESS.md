# How Users Access the LinkedIn Skill

## Overview

The LinkedIn skill is **automatically available** to all BlitzClaw instances. Users don't need to install anything — they just need to:

1. Add their LinkedIn credentials to the Secrets page
2. Start using LinkedIn commands in chat

## User Journey

### Step 1: Add Credentials (Dashboard)

```
BlitzClaw Dashboard
└── Secrets
    └── Add Secret
        ├── LINKEDIN_EMAIL: your@email.com
        └── LINKEDIN_PASSWORD: yourpassword
```

The dashboard already has a Secrets page. Users add two secrets:
- `LINKEDIN_EMAIL`
- `LINKEDIN_PASSWORD`

### Step 2: Use LinkedIn Commands (Chat)

Once credentials are stored, users can immediately use LinkedIn commands:

```
User: "Post to LinkedIn: Excited to announce our new product launch! 🚀"

Agent: "I'll post this to LinkedIn for you..."
       [logs in, creates post]
       "✅ Posted to LinkedIn! View it here: [link]"
```

## How the Agent Knows About the Skill

### Option A: Skill Auto-Loading (Recommended)

Skills are placed in `/opt/blitzclaw/skills/` on each instance. OpenClaw automatically loads skill descriptions and uses them when relevant tasks are requested.

The skill's `SKILL.md` contains a `description` that tells the agent when to use it:

```yaml
description: Automate LinkedIn - post content, reply to DMs, send connection requests
```

When a user says "post to LinkedIn", the agent:
1. Sees "LinkedIn" in the request
2. Finds the matching skill by description
3. Reads the full SKILL.md for instructions
4. Executes the appropriate script

### Option B: Persona Templates (Alternative)

For users who specifically want a "LinkedIn Assistant", we could create a persona template that explicitly includes LinkedIn skill knowledge in the SOUL.md:

```markdown
# SOUL.md - LinkedIn Assistant

You are a LinkedIn automation assistant. You help users:
- Post content to LinkedIn
- Reply to LinkedIn DMs
- Send connection requests
- Engage with their feed

You have access to the LinkedIn skill. When users ask for LinkedIn tasks,
use the scripts at /opt/blitzclaw/skills/linkedin/scripts/
```

## Technical Implementation

### Cloud-Init Changes Needed

Add to the cloud-init script (`apps/web/src/lib/cloud-init.ts`):

```bash
# Install Playwright and dependencies
npm install -g playwright
npx playwright install chromium
npx playwright install-deps chromium

# Copy LinkedIn skill
mkdir -p /opt/blitzclaw/skills/linkedin
# ... copy skill files
```

### Skill Location on Instance

```
/opt/blitzclaw/
├── skills/
│   └── linkedin/
│       ├── SKILL.md
│       ├── package.json
│       └── scripts/
│           ├── login.ts
│           ├── post.ts
│           └── messages.ts
└── openclaw.json
```

### OpenClaw Configuration

In `openclaw.json`, add skill path:

```json
{
  "skillPaths": [
    "/opt/blitzclaw/skills"
  ]
}
```

## Dashboard UI (Future Enhancement)

Could add a "Skills" page to the dashboard:

```
Dashboard
├── Instances
├── Billing
├── Secrets
└── Skills (new)
    ├── LinkedIn ✅ Enabled
    │   └── Requires: LINKEDIN_EMAIL, LINKEDIN_PASSWORD
    ├── Twitter ❌ Coming Soon
    └── Email ❌ Coming Soon
```

Users could enable/disable skills and see which secrets are required.

## Security Considerations

1. **Credentials encrypted at rest** — already implemented in Secrets
2. **Credentials never logged** — scripts should not log sensitive data
3. **Per-instance isolation** — each user's instance is separate
4. **User consent** — user explicitly adds credentials, knows the risk

## FAQ

### "How do I enable the LinkedIn skill?"

Just add your credentials to Dashboard → Secrets. The skill is always available.

### "Can I disable the skill?"

Remove the `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD` secrets. Without credentials, the skill won't work.

### "Is this safe?"

Your credentials are encrypted and stored only on your instance. However, LinkedIn automation violates their ToS, so there's always a risk of account restrictions.
