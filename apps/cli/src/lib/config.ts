import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".blitzclaw");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface Config {
  apiUrl: string;
  auth?: {
    token: string;
    expiresAt: string;
  };
  defaults?: {
    format: "table" | "json" | "yaml";
    persona: string;
  };
}

const DEFAULT_CONFIG: Config = {
  apiUrl: process.env.BLITZCLAW_API_URL || "http://localhost:3000/api",
  defaults: {
    format: "table",
    persona: "assistant",
  },
};

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureConfigDir();
  
  if (!existsSync(CONFIG_FILE)) {
    return DEFAULT_CONFIG;
  }
  
  try {
    const content = readFileSync(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getToken(): string | null {
  const config = loadConfig();
  
  // Check environment variable first
  const envToken = process.env.BLITZCLAW_API_KEY;
  if (envToken) {
    return envToken;
  }
  
  if (!config.auth?.token) {
    return null;
  }
  
  // Check if token is expired
  if (config.auth.expiresAt && new Date(config.auth.expiresAt) < new Date()) {
    return null;
  }
  
  return config.auth.token;
}

export function setToken(token: string, expiresAt?: Date): void {
  const config = loadConfig();
  config.auth = {
    token,
    expiresAt: expiresAt?.toISOString() || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Default 30 days
  };
  saveConfig(config);
}

export function clearToken(): void {
  const config = loadConfig();
  delete config.auth;
  saveConfig(config);
}

export function getApiUrl(): string {
  const config = loadConfig();
  return process.env.BLITZCLAW_API_URL || config.apiUrl;
}
