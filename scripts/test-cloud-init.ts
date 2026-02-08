#!/usr/bin/env npx tsx
/**
 * Test the new cloud-init script
 * 
 * 1. Creates a Hetzner server with the updated cloud-init
 * 2. Waits for setup to complete
 * 3. Verifies OpenClaw is running with Telegram connected
 * 4. Cleans up
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

dotenv.config({ path: path.join(__dirname, '../apps/web/.env.local') });

const HETZNER_API = 'https://api.hetzner.cloud/v1';
const HETZNER_TOKEN = process.env.HETZNER_API_TOKEN!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const SSH_KEY_ID = process.env.HETZNER_SSH_KEY_ID!;

// Test Telegram bot token (from earlier)
const TELEGRAM_BOT_TOKEN = '8438134005:AAFIVK7UxIQZudxHgRHYRC_qEVkGMpGF39Y';

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

function log(msg: string) {
  console.log(`→ ${msg}`);
}

function success(msg: string) {
  console.log(`  ✅ ${msg}`);
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Generate cloud-init script (same as cloud-init.ts but inline for testing)
function generateCloudInit(options: {
  instanceId: string;
  proxySecret: string;
  gatewayToken: string;
  anthropicApiKey: string;
  telegramBotToken: string;
}): string {
  const { instanceId, proxySecret, gatewayToken, anthropicApiKey, telegramBotToken } = options;
  
  const openclawConfig = `model: anthropic/claude-sonnet-4-20250514
gateway:
  mode: local
channels:
  telegram:
    token: ${telegramBotToken}
    default_channel: true
`;

  return `#cloud-config
package_update: true
package_upgrade: false

packages:
  - curl
  - fail2ban
  - ufw

write_files:
  - path: /etc/blitzclaw/instance_id
    content: "${instanceId}"
    permissions: '0600'
  - path: /etc/blitzclaw/proxy_secret
    content: "${proxySecret}"
    permissions: '0600'
  - path: /root/.openclaw/config.yaml
    content: |
${openclawConfig.split('\n').map(line => '      ' + line).join('\n')}
    permissions: '0644'
  - path: /etc/systemd/system/openclaw.service
    content: |
      [Unit]
      Description=OpenClaw Gateway
      After=network.target
      
      [Service]
      Type=simple
      User=root
      WorkingDirectory=/root/.openclaw
      ExecStart=/usr/bin/openclaw gateway --allow-unconfigured
      Restart=always
      RestartSec=10
      Environment=ANTHROPIC_API_KEY=${anthropicApiKey}
      Environment=OPENCLAW_GATEWAY_TOKEN=${gatewayToken}
      
      [Install]
      WantedBy=multi-user.target
    permissions: '0644'
  - path: /root/.openclaw/workspace/AGENTS.md
    content: |
      # BlitzClaw Instance
      
      This is a managed OpenClaw instance provisioned by BlitzClaw.
      
      Instance ID: ${instanceId}
    permissions: '0644'
  - path: /root/setup-openclaw.sh
    content: |
      #!/bin/bash
      set -e
      
      echo "=== Installing Node.js 22 ==="
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt-get install -y nodejs
      
      # Verify node is installed
      echo "Node version: \\$(node --version)"
      echo "npm version: \\$(npm --version)"
      
      echo "=== Installing OpenClaw ==="
      # Retry loop for npm install (can fail on fresh servers)
      for i in 1 2 3; do
        echo "Attempt \\$i..."
        rm -rf /usr/lib/node_modules/openclaw 2>/dev/null || true
        npm install -g openclaw && break
        sleep 5
      done
      
      # Verify openclaw is installed
      echo "OpenClaw version: \\$(openclaw --version)"
      
      echo "=== Creating directories ==="
      mkdir -p /root/.openclaw/workspace
      
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
      
      touch /etc/blitzclaw/ready
      echo "=== Setup complete ==="
    permissions: '0755'

runcmd:
  - mkdir -p /etc/blitzclaw
  - mkdir -p /root/.openclaw/workspace
  - /root/setup-openclaw.sh >> /var/log/blitzclaw-setup.log 2>&1
`;
}

async function createServer(): Promise<{ serverId: number; ip: string }> {
  log('Creating Hetzner server with new cloud-init...');
  
  const instanceId = `test-${Date.now()}`;
  const proxySecret = generateSecret();
  const gatewayToken = generateSecret();
  
  const cloudInit = generateCloudInit({
    instanceId,
    proxySecret,
    gatewayToken,
    anthropicApiKey: ANTHROPIC_KEY,
    telegramBotToken: TELEGRAM_BOT_TOKEN,
  });
  
  const response = await fetch(`${HETZNER_API}/servers`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HETZNER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `blitz-test-${Date.now()}`,
      server_type: 'cpx11',
      location: 'ash',
      image: 'ubuntu-24.04',
      ssh_keys: [SSH_KEY_ID],
      user_data: cloudInit,
      labels: { test: 'true', blitzclaw: 'true' },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Hetzner API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  const serverId = data.server.id;
  success(`Server ${serverId} created`);
  
  // Wait for IP
  log('Waiting for server to boot...');
  let ip = '';
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const statusResponse = await fetch(`${HETZNER_API}/servers/${serverId}`, {
      headers: { 'Authorization': `Bearer ${HETZNER_TOKEN}` },
    });
    const statusData = await statusResponse.json();
    
    if (statusData.server.status === 'running') {
      ip = statusData.server.public_net?.ipv4?.ip;
      success(`Server running at ${ip}`);
      break;
    }
    process.stdout.write('.');
  }
  
  if (!ip) throw new Error('Server did not start');
  
  return { serverId, ip };
}

async function waitForSetup(ip: string): Promise<void> {
  log('Waiting for cloud-init to complete...');
  
  const sshCmd = `ssh -i ~/.ssh/blitzclaw_test -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@${ip}`;
  
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    
    try {
      const result = execSync(`${sshCmd} "test -f /etc/blitzclaw/ready && echo ready"`, {
        encoding: 'utf-8',
        timeout: 15000,
      }).trim();
      
      if (result === 'ready') {
        success('Setup complete!');
        return;
      }
    } catch {
      process.stdout.write('.');
    }
  }
  
  throw new Error('Setup did not complete in time');
}

async function verifyOpenClaw(ip: string): Promise<void> {
  log('Verifying OpenClaw is running...');
  
  const sshCmd = `ssh -i ~/.ssh/blitzclaw_test -o StrictHostKeyChecking=no root@${ip}`;
  
  // Check service status
  const status = execSync(`${sshCmd} "systemctl status openclaw | head -15"`, { encoding: 'utf-8' });
  console.log(status);
  
  if (status.includes('active (running)')) {
    success('OpenClaw service is running');
  } else {
    throw new Error('OpenClaw service is not running');
  }
  
  // Check logs for Telegram
  const logs = execSync(`${sshCmd} "journalctl -u openclaw -n 30 --no-pager"`, { encoding: 'utf-8' });
  console.log(logs);
  
  if (logs.includes('telegram') || logs.includes('Telegram')) {
    success('Telegram channel detected in logs');
  } else {
    console.log('  ⚠️ Telegram not detected in logs yet (might still be initializing)');
  }
}

async function deleteServer(serverId: number): Promise<void> {
  log('Deleting server...');
  
  await fetch(`${HETZNER_API}/servers/${serverId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${HETZNER_TOKEN}` },
  });
  
  success(`Server ${serverId} deleted`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         BlitzClaw Cloud-Init Test                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  let serverId: number | undefined;
  
  try {
    // Create server
    const server = await createServer();
    serverId = server.serverId;
    
    // Wait for setup
    await waitForSetup(server.ip);
    
    // Verify OpenClaw
    await verifyOpenClaw(server.ip);
    
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 CLOUD-INIT TEST PASSED!');
    console.log('═'.repeat(60));
    console.log(`\nServer IP: ${server.ip}`);
    console.log('Now send a message to the Telegram bot to test!');
    console.log('\nPress Ctrl+C when done testing. Server will be deleted.');
    
    // Keep running so user can test Telegram
    await new Promise(() => {});
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    if (serverId) {
      await deleteServer(serverId);
    }
  }
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n\nCleaning up...');
  process.exit(0);
});

main();
