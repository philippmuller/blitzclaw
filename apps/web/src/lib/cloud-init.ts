/**
 * Cloud-init template generator for BlitzClaw instances
 * 
 * This generates the user-data script that runs when a new Hetzner server boots.
 * It installs OpenClaw, sets up security, and prepares the server for configuration.
 */

export interface CloudInitOptions {
  instanceId: string;
  proxySecret: string;
  gatewayToken: string;
  anthropicApiKey: string;
  telegramBotToken?: string;
  braveApiKey?: string;
  model?: string;
  blitzclawApiUrl?: string;
}

/**
 * Generate cloud-init user-data for a new BlitzClaw server
 */
export function generateCloudInit(options: CloudInitOptions): string {
  const {
    instanceId,
    proxySecret,
    gatewayToken,
    anthropicApiKey,
    telegramBotToken,
    braveApiKey,
    model = "claude-opus-4-20250514",
    // Always use production URL for callbacks (preview URLs require Vercel auth)
    blitzclawApiUrl = "https://www.blitzclaw.com",
  } = options;

  // Generate OpenClaw config JSON
  // Routes API calls through BlitzClaw billing proxy for usage metering
  const openclawConfig = {
    meta: {
      lastTouchedVersion: "blitzclaw-provisioned",
      lastTouchedAt: new Date().toISOString()
    },
    gateway: {
      mode: "local",
      auth: {
        mode: "token",
        token: gatewayToken
      },
      port: 18789,
      bind: "0.0.0.0"  // Expose for web UI access (token auth protects it)
    },
    models: {
      providers: {
        // BlitzClaw billing proxy - routes through our server for metering
        "blitzclaw": {
          baseUrl: `${blitzclawApiUrl}/api/proxy`,
          api: "anthropic-messages",  // Use Anthropic Messages API format
          models: [
            {
              id: "claude-sonnet-4-20250514",
              name: "Claude Sonnet 4",
              input: ["text", "image"],
              contextWindow: 200000,
              maxTokens: 8192
            },
            {
              id: "claude-opus-4-20250514",
              name: "Claude Opus 4",
              input: ["text", "image"],
              contextWindow: 200000,
              maxTokens: 8192
            },
            {
              id: "claude-3-5-haiku-20241022",
              name: "Claude 3.5 Haiku",
              input: ["text", "image"],
              contextWindow: 200000,
              maxTokens: 8192
            }
          ]
        }
      }
    },
    agents: {
      defaults: {
        workspace: "/root/.openclaw/workspace",
        model: {
          primary: `blitzclaw/${model}`
        }
      },
      list: [
        {
          id: "main",
          default: true,
          identity: {
            name: "Assistant",
            emoji: "🤖"
          }
        }
      ]
    },
    // Web tools config (Brave Search)
    ...(braveApiKey ? {
      tools: {
        web: {
          search: {
            enabled: true,
            provider: "brave",
            apiKey: braveApiKey,
          },
          fetch: {
            enabled: true,
          },
        },
      },
    } : {}),
    ...(telegramBotToken ? {
      channels: {
        telegram: {
          enabled: true,
          botToken: telegramBotToken,
          dmPolicy: "open",
          allowFrom: ["*"]
        }
      },
      plugins: {
        entries: {
          telegram: { enabled: true }
        }
      }
    } : {})
  };

  // Auth profiles - proxySecret as API key for our billing proxy
  const authProfilesJson = {
    version: 1,
    profiles: {
      "blitzclaw:default": {
        type: "api_key",
        provider: "blitzclaw",
        key: proxySecret
      }
    },
    lastGood: {
      blitzclaw: "blitzclaw:default"
    }
  };

  // YAML cloud-config - write_files for all JSON, simple shell script
  const cloudConfig = `#cloud-config
package_update: true
package_upgrade: false

packages:
  - curl
  - fail2ban
  - ufw
  - jq
  - chromium-browser
  - fonts-liberation
  - libnss3
  - libatk-bridge2.0-0
  - libgtk-3-0

write_files:
  - path: /etc/blitzclaw/instance_id
    content: "${instanceId}"
    permissions: '0600'

  - path: /etc/blitzclaw/proxy_secret
    content: "${proxySecret}"
    permissions: '0600'

  - path: /root/.openclaw/openclaw.json
    permissions: '0600'
    content: |-
${JSON.stringify(openclawConfig, null, 2).split('\n').map(line => '      ' + line).join('\n')}

  - path: /root/.openclaw/agents/main/agent/auth-profiles.json
    permissions: '0600'
    content: |-
${JSON.stringify(authProfilesJson, null, 2).split('\n').map(line => '      ' + line).join('\n')}

  - path: /etc/systemd/system/openclaw.service
    permissions: '0644'
    content: |
      [Unit]
      Description=OpenClaw Gateway
      After=network.target
      
      [Service]
      Type=simple
      User=root
      WorkingDirectory=/root/.openclaw
      ExecStart=/usr/bin/openclaw gateway
      Restart=always
      RestartSec=10
      
      [Install]
      WantedBy=multi-user.target

  - path: /root/.openclaw/workspace/AGENTS.md
    permissions: '0644'
    content: |
      # BlitzClaw Instance
      
      This is a managed OpenClaw instance provisioned by BlitzClaw.
      
      Instance ID: ${instanceId}

  - path: /root/setup-openclaw.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      set -e
      
      echo "=== Installing Node.js 22 ==="
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt-get install -y nodejs
      
      echo "Node version: $(node --version)"
      echo "npm version: $(npm --version)"
      
      echo "=== Installing OpenClaw ==="
      for i in 1 2 3; do
        echo "Attempt $i..."
        rm -rf /usr/lib/node_modules/openclaw 2>/dev/null || true
        npm install -g openclaw && break
        sleep 5
      done
      
      echo "OpenClaw version: $(openclaw --version)"
      
      echo "=== Setting permissions ==="
      chmod 700 /root/.openclaw
      chmod 600 /root/.openclaw/openclaw.json
      chmod 600 /root/.openclaw/agents/main/agent/auth-profiles.json
      
      echo "=== Setting up firewall ==="
      ufw default deny incoming
      ufw default allow outgoing
      ufw allow 22/tcp
      ufw allow 18789/tcp  # OpenClaw Web UI (token auth protected)
      ufw --force enable
      
      echo "=== Starting OpenClaw ==="
      systemctl daemon-reload
      systemctl enable openclaw
      systemctl start openclaw
      
      sleep 5
      systemctl status openclaw || true
      
      echo "=== Signaling ready ==="
      curl -X POST "${blitzclawApiUrl}/api/internal/instance-ready" \
        -H "Content-Type: application/json" \
        -H "X-Instance-Secret: ${proxySecret}" \
        -d '{"instance_id": "${instanceId}"}' \
        || echo "Callback failed (non-fatal)"
      
      touch /etc/blitzclaw/ready
      echo "=== Setup complete ==="

runcmd:
  - mkdir -p /etc/blitzclaw
  - mkdir -p /root/.openclaw/workspace
  - mkdir -p /root/.openclaw/agents/main/agent
  - mkdir -p /root/.openclaw/agents/main/sessions
  - chmod 700 /root/.openclaw/agents/main/agent
  - /root/setup-openclaw.sh >> /var/log/blitzclaw-setup.log 2>&1
`;

  return cloudConfig;
}

/**
 * Generate OpenClaw config JSON for an instance
 */
export interface OpenClawConfig {
  model?: string;
  proxyEndpoint?: string;
  instanceId: string;
  proxySecret?: string;
  telegramBotToken?: string;
  telegramAllowList?: string[];
}

export function generateOpenClawConfig(config: OpenClawConfig): string {
  const jsonConfig = {
    meta: {
      lastTouchedVersion: "blitzclaw-provisioned",
      lastTouchedAt: new Date().toISOString(),
      instanceId: config.instanceId
    },
    agents: {
      defaults: {
        workspace: "/root/.openclaw/workspace",
        ...(config.model ? { model: { primary: config.model } } : {})
      },
      list: [
        {
          id: "main",
          default: true,
          identity: {
            name: "Assistant",
            emoji: "🤖"
          }
        }
      ]
    },
    ...(config.telegramBotToken ? {
      channels: {
        telegram: {
          enabled: true,
          botToken: config.telegramBotToken,
          ...(config.telegramAllowList?.length ? {
            dmPolicy: "allowlist",
            allowFrom: config.telegramAllowList
          } : {
            dmPolicy: "open",
            allowFrom: ["*"]
          })
        }
      },
      plugins: {
        entries: {
          telegram: { enabled: true }
        }
      }
    } : {})
  };

  return JSON.stringify(jsonConfig, null, 2);
}

/**
 * Generate SOUL.md content based on persona template
 */
export function generateSoulMd(persona: string, customSoul?: string): string {
  if (customSoul) {
    return customSoul;
  }

  const templates: Record<string, string> = {
    assistant: `# SOUL.md — Your Personal Assistant

## Who You Are
You're a helpful, efficient personal assistant. Warm but not chatty. You get things done.

## Communication Style
- Be concise — respect the user's time
- Be proactive — suggest next steps when helpful
- Be direct — say what you mean, no corporate speak
- Use emoji sparingly for warmth ✨

## What You Help With
- Daily planning and reminders
- Quick research and answers  
- Writing, editing, summarizing
- General problem-solving

## Boundaries
- Keep conversations focused
- Admit when you don't know something
- Ask clarifying questions when needed

*You're the assistant everyone wishes they had — helpful without being annoying.*
`,
    coder: `# SOUL.md — Your Code Helper

## Who You Are
You're a technical assistant who thinks like a developer. Precise, practical, and good at debugging.

## Communication Style
- Show code, not just talk about it
- Explain your reasoning briefly
- Use proper formatting (code blocks, lists)
- Be direct about tradeoffs

## What You Help With
- Code review and suggestions
- Debugging and troubleshooting
- Architecture decisions
- Documentation and explaining code
- Git workflows

## Preferences
- Prefer simple solutions over clever ones
- Consider edge cases
- Think about maintainability
- CLI-first when possible

*You're the senior dev who actually explains things instead of just saying "RTFM".*
`,
    creative: `# SOUL.md — Your Creative Partner

## Who You Are
You're a creative collaborator — imaginative, encouraging, and good at building on ideas.

## Communication Style
- Be enthusiastic but not fake
- Ask "what if" questions
- Offer alternatives, not just answers
- Match the user's energy

## What You Help With
- Brainstorming and ideation
- Writing and storytelling
- Content planning
- Feedback and editing
- Finding unique angles

## Creative Philosophy
- Bad ideas lead to good ideas
- First drafts are supposed to be rough
- Constraints breed creativity
- Steal like an artist

*You're the friend who makes brainstorms actually productive.*
`,
    casual: `# SOUL.md — Your Chill Assistant

## Who You Are
You're a relaxed, friendly AI. Like texting a smart friend who's always available.

## Communication Style
- Keep it casual, lowercase is fine
- Use emoji naturally 😊
- Be conversational, not formal
- Match the vibe

## What You Help With
- Whatever you need, honestly
- Quick questions and answers
- Chatting through problems
- Light research
- Being a sounding board

## Vibes
- No judgment
- Keep it real
- Don't overthink it
- Sometimes the best help is just listening

*You're the friend who always has good advice but doesn't make it weird.*
`,
    custom: `# SOUL.md — Custom Assistant

Configure this file to define your AI's personality and capabilities.

## Identity
- **Name:** (optional)
- **Role:** (what are you?)
- **Vibe:** (how do you communicate?)

## What You Help With
- (list the main things)

## Communication Style
- (how should you talk?)

## Boundaries
- (what won't you do?)

## Special Instructions
- (anything else?)

*Make it your own — this file shapes who your assistant is.*
`,
  };

  return templates[persona] || templates.custom;
}
