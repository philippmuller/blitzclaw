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
  byokMode?: boolean;  // If true, use user's Anthropic key directly (no proxy)
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
    model = "claude-opus-4-6",
    // Always use production URL for callbacks (preview URLs require Vercel auth)
    blitzclawApiUrl = "https://www.blitzclaw.com",
    byokMode = false,
  } = options;

  // Generate model provider config based on mode
  // BYOK mode: Don't define models - OpenClaw uses built-in Anthropic support with API key from auth-profiles.json
  // Managed mode: Define custom "blitzclaw" provider that proxies to our billing endpoint
  const modelsConfig = byokMode ? {} : {
    // Managed mode: route through BlitzClaw billing proxy
    providers: {
      "blitzclaw": {
        baseUrl: `${blitzclawApiUrl}/api/proxy`,
        api: "anthropic-messages",
        models: [
          {
            id: "claude-opus-4-6",
            name: "Claude Opus 4.6",
            input: ["text", "image"],
            contextWindow: 200000,
            maxTokens: 8192
          },
          {
            id: "claude-sonnet-4-5",
            name: "Claude Sonnet 4.5",
            input: ["text", "image"],
            contextWindow: 200000,
            maxTokens: 8192
          },
          {
            id: "claude-haiku-4-5",
            name: "Claude Haiku 4.5",
            input: ["text", "image"],
            contextWindow: 200000,
            maxTokens: 8192
          }
        ]
      }
    }
  };

  // Model prefix depends on mode
  const modelPrefix = byokMode ? "anthropic" : "blitzclaw";

  // Generate OpenClaw config JSON
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
      bind: "lan"  // Expose for web UI access (token auth protects it) - "lan" means 0.0.0.0
    },
    models: modelsConfig,
    agents: {
      defaults: {
        workspace: "/root/.openclaw/workspace",
        model: {
          primary: `${modelPrefix}/${model}`
        },
        sandbox: {
          browser: {
            enabled: false,        // Don't require Docker sandbox browser
            allowHostControl: true, // Allow agent to use host browser directly
          },
        },
      },
      list: [
        {
          id: "main",
          default: true,
          identity: {
            name: "Assistant",
            emoji: ":robot:"
          }
        }
      ]
    },
    // Browser config for headless operation
    browser: {
      enabled: true,
      headless: true,
      noSandbox: true,  // Required for running as root
      defaultProfile: "openclaw",
      executablePath: "/snap/bin/chromium",
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

  // Auth profiles - depends on mode
  const authProfilesJson = byokMode ? {
    // BYOK mode: use Anthropic directly
    version: 1,
    profiles: {
      "anthropic:default": {
        type: "api_key",
        provider: "anthropic",
        key: anthropicApiKey
      }
    },
    lastGood: {
      anthropic: "anthropic:default"
    }
  } : {
    // Managed mode: proxySecret as API key for our billing proxy
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
  - chromium
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

  - path: /root/.openclaw/exec-approvals.json
    permissions: '0600'
    content: |-
${JSON.stringify({
  version: 1,
  defaults: {
    security: "allowlist",
    ask: "off",
    askFallback: "allow",
    autoAllowSkills: true
  },
  agents: {
    main: {
      security: "allowlist",
      ask: "off",
      askFallback: "allow",
      autoAllowSkills: true,
      allowlist: [
        {pattern: "cat"}, {pattern: "head"}, {pattern: "tail"}, {pattern: "less"},
        {pattern: "grep"}, {pattern: "awk"}, {pattern: "sed"}, {pattern: "sort"},
        {pattern: "uniq"}, {pattern: "wc"}, {pattern: "jq"}, {pattern: "tr"},
        {pattern: "ls"}, {pattern: "find"}, {pattern: "stat"}, {pattern: "file"},
        {pattern: "tree"}, {pattern: "du"}, {pattern: "df"}, {pattern: "pwd"},
        {pattern: "date"}, {pattern: "whoami"}, {pattern: "hostname"}, {pattern: "uname"},
        {pattern: "env"}, {pattern: "printenv"}, {pattern: "id"}, {pattern: "uptime"},
        {pattern: "curl"}, {pattern: "wget"}, {pattern: "ping"}, {pattern: "dig"},
        {pattern: "git"}, {pattern: "gh"}, {pattern: "node"}, {pattern: "npm"},
        {pattern: "npx"}, {pattern: "python"}, {pattern: "python3"}, {pattern: "pip"},
        {pattern: "pip3"}, {pattern: "mkdir"}, {pattern: "touch"}, {pattern: "cp"},
        {pattern: "mv"}, {pattern: "ln"}, {pattern: "tar"}, {pattern: "zip"},
        {pattern: "unzip"}, {pattern: "gzip"}, {pattern: "echo"}, {pattern: "printf"},
        {pattern: "base64"}, {pattern: "md5sum"}, {pattern: "sha256sum"}, {pattern: "openclaw"}
      ]
    }
  }
}, null, 2).split('\n').map(line => '      ' + line).join('\n')}

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

  - path: /root/.openclaw/secrets.env
    permissions: '0600'
    content: |
      # User secrets - managed via BlitzClaw dashboard
      # Source this file to access API keys and tokens

  - path: /root/.openclaw/workspace/AGENTS.md
    permissions: '0644'
    content: |
      # BlitzClaw Instance
      
      This is a managed OpenClaw instance provisioned by BlitzClaw.
      
      Instance ID: ${instanceId}
      
      ## Screenshots (Browser Workaround)
      
      If the browser tool fails, use chromium directly:
      
      \`\`\`bash
      chromium --headless --no-sandbox --disable-gpu --screenshot=/tmp/shot.png --window-size=1280,800 "https://example.com"
      \`\`\`
      
      **Important:** Snap sandboxes the filesystem. The actual file is at:
      \`/tmp/snap-private-tmp/snap.chromium/tmp/shot.png\`
      
      Copy it to your workspace before sending:
      \`\`\`bash
      cp /tmp/snap-private-tmp/snap.chromium/tmp/shot.png /root/.openclaw/workspace/
      \`\`\`
      
      ## Secrets
      User secrets are available at /root/.openclaw/secrets.env
      Source this file to access API keys and tokens the user has shared.
      
      Example: \`source /root/.openclaw/secrets.env && echo $GITHUB_TOKEN\`

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
      # Port 18789 NOT exposed - Web UI only accessible via SSH tunnel if needed
      # Users chat via Telegram, no public web UI for MVP
      ufw --force enable
      
      echo "=== Starting OpenClaw ==="
      systemctl daemon-reload
      systemctl enable openclaw
      systemctl start openclaw
      
      sleep 5
      systemctl status openclaw || true
      
      echo "=== Signaling ready ==="
      # Get server ID from metadata service (DigitalOcean or Hetzner)
      SERVER_ID=$(curl -s --fail http://169.254.169.254/metadata/v1/id || true)
      if [ -z "$SERVER_ID" ]; then
        SERVER_ID=$(curl -s --fail http://169.254.169.254/hetzner/v1/metadata/instance-id || echo "${instanceId}")
      fi
      curl -X POST "${blitzclawApiUrl}/api/internal/instance-ready" \
        -H "Content-Type: application/json" \
        -H "X-Instance-Secret: ${proxySecret}" \
        -d '{"instance_id": "'"$SERVER_ID"'"}' \
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
            emoji: ":robot:"
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
- Use emoji sparingly for warmth *

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
- Use emoji naturally :)
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
