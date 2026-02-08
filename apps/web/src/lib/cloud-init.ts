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
    blitzclawApiUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : "https://www.blitzclaw.com",
  } = options;

  // Generate OpenClaw config JSON
  // Key requirements:
  // - gateway.mode: "local" (required to skip setup wizard)
  // - gateway.auth.token: for securing the gateway
  // - channels.telegram.botToken: the Telegram token (not "token"!)
  // - channels.telegram.enabled: true
  // - channels.telegram.dmPolicy: "open" (no pairing for managed instances)
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
      bind: "loopback"
    },
    agents: {
      defaults: {
        workspace: "/root/.openclaw/workspace"
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
    ...(telegramBotToken ? {
      channels: {
        telegram: {
          enabled: true,
          botToken: telegramBotToken,
          dmPolicy: "open",     // No pairing for managed instances
          allowFrom: ["*"]      // Required when dmPolicy is "open"
        }
      },
      plugins: {
        entries: {
          telegram: { enabled: true }
        }
      }
    } : {})
  };

  // YAML cloud-config - using shell script for reliability
  const cloudConfig = `#cloud-config
package_update: true
package_upgrade: false

packages:
  - curl
  - fail2ban
  - ufw
  - jq

write_files:
  - path: /etc/blitzclaw/instance_id
    content: "${instanceId}"
    permissions: '0600'
  - path: /etc/blitzclaw/proxy_secret
    content: "${proxySecret}"
    permissions: '0600'
  - path: /root/.openclaw/openclaw.json
    content: |
${JSON.stringify(openclawConfig, null, 2).split('\n').map(line => '      ' + line).join('\n')}
    permissions: '0600'
  - path: /etc/systemd/system/openclaw.service
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
    permissions: '0644'
  - path: /root/.openclaw/workspace/AGENTS.md
    content: |
      # BlitzClaw Instance
      
      This is a managed OpenClaw instance provisioned by BlitzClaw.
      
      Instance ID: ${instanceId}
    permissions: '0644'
  - path: /root/.openclaw/agents/main/agent/auth-profiles.json
    content: |
      {
        "version": 1,
        "profiles": {
          "anthropic:default": {
            "type": "api_key",
            "provider": "anthropic",
            "key": "${anthropicApiKey}"
          }
        },
        "lastGood": {
          "anthropic": "anthropic:default"
        }
      }
    permissions: '0600'
  - path: /root/setup-openclaw.sh
    content: |
      #!/bin/bash
      set -e
      
      echo "=== Installing Node.js 22 ==="
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt-get install -y nodejs
      
      # Verify node is installed
      echo "Node version: $(node --version)"
      echo "npm version: $(npm --version)"
      
      echo "=== Installing OpenClaw ==="
      # Retry loop for npm install (can fail on fresh servers)
      for i in 1 2 3; do
        echo "Attempt $i..."
        rm -rf /usr/lib/node_modules/openclaw 2>/dev/null || true
        npm install -g openclaw && break
        sleep 5
      done
      
      # Verify openclaw is installed
      echo "OpenClaw version: $(openclaw --version)"
      
      echo "=== Creating directories ==="
      mkdir -p /root/.openclaw/workspace
      mkdir -p /root/.openclaw/agents/main/agent
      mkdir -p /root/.openclaw/agents/main/sessions
      chmod 700 /root/.openclaw
      chmod 600 /root/.openclaw/openclaw.json
      chmod 600 /root/.openclaw/agents/main/agent/auth-profiles.json 2>/dev/null || true
      
      echo "=== Setting up firewall ==="
      ufw default deny incoming
      ufw default allow outgoing
      ufw allow 22/tcp
      ufw --force enable
      
      echo "=== Starting OpenClaw ==="
      systemctl daemon-reload
      systemctl enable openclaw
      systemctl start openclaw
      
      # Wait for service to start
      sleep 5
      
      echo "=== Checking service status ==="
      systemctl status openclaw || true
      
      echo "=== Signaling ready ==="
      curl -X POST "${blitzclawApiUrl}/api/internal/instance-ready" \\
        -H "Content-Type: application/json" \\
        -H "X-Instance-Secret: ${proxySecret}" \\
        -d '{"instance_id": "${instanceId}"}' \\
        || echo "Callback failed (non-fatal)"
      
      touch /etc/blitzclaw/ready
      echo "=== Setup complete ==="
    permissions: '0755'

runcmd:
  - mkdir -p /etc/blitzclaw
  - mkdir -p /root/.openclaw/workspace
  - mkdir -p /root/.openclaw/agents/main/agent
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
    assistant: `# SOUL.md

You are a personal assistant. Helpful, proactive, concise.

You help with:
- Daily planning and reminders
- Quick research and answers
- Writing and editing
- General productivity

Be warm but efficient. Respect the user's time.
`,
    developer: `# SOUL.md

You are a technical assistant for developers.

You help with:
- Code review and suggestions
- Debugging and problem-solving
- Documentation
- Git workflows

Be precise and technical. Show code examples when relevant.
`,
    creative: `# SOUL.md

You are a creative collaborator.

You help with:
- Brainstorming and ideation
- Writing and storytelling
- Content planning
- Feedback and editing

Be imaginative but grounded. Push ideas forward.
`,
    custom: `# SOUL.md

This is your custom assistant. Configure the personality and capabilities by editing this file.

You can define:
- Personality traits
- Areas of expertise
- Communication style
- Specific instructions

Make it your own!
`,
  };

  return templates[persona] || templates.custom;
}
