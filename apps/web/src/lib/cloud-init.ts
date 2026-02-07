/**
 * Cloud-init template generator for BlitzClaw instances
 * 
 * This generates the user-data script that runs when a new Hetzner server boots.
 * It installs OpenClaw, sets up security, and prepares the server for configuration.
 */

export interface CloudInitOptions {
  instanceId: string;
  proxySecret: string;
  blitzclawApiIp?: string;
  proxyEndpoint?: string;
}

/**
 * Generate cloud-init user-data for a new BlitzClaw server
 */
export function generateCloudInit(options: CloudInitOptions): string {
  const {
    instanceId,
    proxySecret,
    blitzclawApiIp = "0.0.0.0/0", // Allow from anywhere initially, will tighten later
    proxyEndpoint = "https://proxy.blitzclaw.com/v1",
  } = options;

  // YAML cloud-config
  const cloudConfig = `#cloud-config
package_update: true
package_upgrade: true

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
  - path: /etc/blitzclaw/proxy_endpoint
    content: "${proxyEndpoint}"
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
      ExecStart=/usr/bin/openclaw gateway start --foreground
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

runcmd:
  # Create directories
  - mkdir -p /etc/blitzclaw
  - mkdir -p /root/.openclaw/workspace
  
  # Install Node.js 22 (LTS)
  - curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  - apt-get install -y nodejs
  
  # Install OpenClaw globally
  - npm install -g openclaw
  
  # Setup firewall
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow from ${blitzclawApiIp} to any port 22  # SSH from BlitzClaw API
  - ufw allow 443/tcp  # HTTPS outbound (for API calls)
  - ufw --force enable
  
  # Configure fail2ban
  - systemctl enable fail2ban
  - systemctl start fail2ban
  
  # Enable OpenClaw service (don't start yet - needs config)
  - systemctl daemon-reload
  - systemctl enable openclaw
  
  # Signal that server is ready for configuration
  - |
    curl -X POST "https://api.blitzclaw.com/api/internal/instance-ready" \\
      -H "Content-Type: application/json" \\
      -H "X-Instance-Secret: ${proxySecret}" \\
      -d '{"instance_id": "${instanceId}"}' \\
      || true  # Don't fail if callback fails
  
  # Create ready marker file
  - touch /etc/blitzclaw/ready
`;

  return cloudConfig;
}

/**
 * Generate the OpenClaw config.yaml for an instance
 */
export interface OpenClawConfig {
  model?: string;
  proxyEndpoint: string;
  instanceId: string;
  proxySecret: string;
  telegramBotToken?: string;
  telegramAllowList?: string[];
}

export function generateOpenClawConfig(config: OpenClawConfig): string {
  const yaml = `# BlitzClaw managed OpenClaw configuration
# Instance ID: ${config.instanceId}
# Do not edit manually - changes may be overwritten

openclaw:
  model: ${config.model || "anthropic/claude-sonnet-4"}
  apiEndpoint: ${config.proxyEndpoint}
  
  # BlitzClaw proxy authentication
  headers:
    X-BlitzClaw-Instance: ${config.instanceId}
    X-BlitzClaw-Secret: ${config.proxySecret}
${config.telegramBotToken ? `
  telegram:
    botToken: ${config.telegramBotToken}
${config.telegramAllowList ? `    allowList:\n${config.telegramAllowList.map(id => `      - ${id}`).join('\n')}` : ''}
` : ''}
`;

  return yaml;
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
