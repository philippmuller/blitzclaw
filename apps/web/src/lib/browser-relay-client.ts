const DEFAULT_RELAY_BASE_URL =
  process.env.NEXT_PUBLIC_PARTYKIT_URL ||
  "wss://blitzclaw-relay.philippmuller.partykit.dev/parties/main";

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 20_000;
const DEFAULT_RECONNECT_MIN_DELAY_MS = 1_000;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 15_000;
const DEFAULT_RECONNECT_MAX_ATTEMPTS = 10;
const SHARED_CLIENT_TTL_MS = 10 * 60 * 1000;

const WS_CONNECTING = 0;
const WS_OPEN = 1;

type ConnectionState = "disconnected" | "connecting" | "connected";

export interface BrowserRelayClientOptions {
  instanceId: string;
  instanceSecret: string;
  relayBaseUrl?: string;
  connectTimeoutMs?: number;
  commandTimeoutMs?: number;
  reconnect?: {
    enabled?: boolean;
    minDelayMs?: number;
    maxDelayMs?: number;
    maxAttempts?: number;
  };
}

export interface SendCdpCommandOptions {
  timeoutMs?: number;
}

export interface RelayAuthMessage {
  type: "auth";
  role: "agent";
  token: string;
}

export interface RelayCdpMessage {
  type: "cdp";
  id: number;
  method: string;
  params: Record<string, unknown>;
}

export interface RelayPongMessage {
  type: "pong";
}

export type BrowserRelayOutgoingMessage = RelayAuthMessage | RelayCdpMessage | RelayPongMessage;

export interface RelayAuthRequiredMessage {
  type: "auth_required";
  message?: string;
}

export interface RelayAuthSuccessMessage {
  type: "auth_success";
  role?: "agent" | "extension";
  roomId?: string;
}

export interface RelayAuthErrorMessage {
  type: "auth_error";
  error?: string;
}

export interface RelayPeerStatusMessage {
  type: "peer_status";
  extensionConnected?: boolean;
  agentConnected?: boolean;
}

export interface RelayPeerConnectedMessage {
  type: "peer_connected";
  peer: "extension" | "agent";
}

export interface RelayPeerDisconnectedMessage {
  type: "peer_disconnected";
  peer: "extension" | "agent";
}

export interface RelayErrorMessage {
  type: "error";
  error?: string;
}

export interface RelayPingMessage {
  type: "ping";
}

export interface RelayPongIncomingMessage {
  type: "pong";
}

export interface RelayCdpResultMessage {
  type: "cdp_result";
  id: number;
  result: unknown;
}

export interface RelayCdpErrorMessage {
  type: "cdp_error";
  id: number;
  error?: string;
}

export interface RelayCdpEventMessage {
  type: "cdp_event";
  method: string;
  params?: Record<string, unknown>;
}

export type BrowserRelayIncomingMessage =
  | RelayAuthRequiredMessage
  | RelayAuthSuccessMessage
  | RelayAuthErrorMessage
  | RelayPeerStatusMessage
  | RelayPeerConnectedMessage
  | RelayPeerDisconnectedMessage
  | RelayErrorMessage
  | RelayPingMessage
  | RelayPongIncomingMessage
  | RelayCdpResultMessage
  | RelayCdpErrorMessage
  | RelayCdpEventMessage;

export type CdpResultCallback = (message: RelayCdpResultMessage | RelayCdpErrorMessage) => void;

type PendingCommand = {
  method: string;
  timeoutId: ReturnType<typeof setTimeout>;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
};

type SharedClientEntry = {
  instanceId: string;
  instanceSecret: string;
  client: BrowserRelayClient;
  lastUsedAt: number;
};

const sharedClients = new Map<string, SharedClientEntry>();

function normalizeRelayBaseUrl(baseUrl?: string): string {
  return (baseUrl || DEFAULT_RELAY_BASE_URL).replace(/\/$/, "");
}

function buildRelayUrl(baseUrl: string, instanceId: string): string {
  return `${normalizeRelayBaseUrl(baseUrl)}/${encodeURIComponent(instanceId)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(fallback);
}

async function decodeMessageData(data: unknown): Promise<string | null> {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }

  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data.buffer);
  }

  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return data.text();
  }

  return null;
}

function parseIncomingMessage(raw: string): BrowserRelayIncomingMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || typeof value.type !== "string") {
      return null;
    }
    return value as unknown as BrowserRelayIncomingMessage;
  } catch {
    return null;
  }
}

function getSharedClientKey(instanceId: string, instanceSecret: string): string {
  return `${instanceId}::${instanceSecret}`;
}

export class BrowserRelayClient {
  private readonly instanceId: string;
  private readonly instanceSecret: string;
  private readonly relayUrl: string;
  private readonly connectTimeoutMs: number;
  private readonly commandTimeoutMs: number;
  private readonly reconnectEnabled: boolean;
  private readonly reconnectMinDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly reconnectMaxAttempts: number;

  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private authenticated = false;
  private extensionConnected = false;
  private shouldReconnect = true;

  private connectPromise: Promise<void> | null = null;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((error: Error) => void) | null = null;
  private connectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private reconnectTimerId: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;

  private nextCommandId = 1;
  private pendingCommands = new Map<number, PendingCommand>();
  private cdpResultCallbacks = new Set<CdpResultCallback>();

  constructor(options: BrowserRelayClientOptions) {
    this.instanceId = options.instanceId;
    this.instanceSecret = options.instanceSecret;
    this.relayUrl = buildRelayUrl(options.relayBaseUrl || DEFAULT_RELAY_BASE_URL, this.instanceId);
    this.connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    this.commandTimeoutMs = options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
    this.reconnectEnabled = options.reconnect?.enabled ?? true;
    this.reconnectMinDelayMs = options.reconnect?.minDelayMs ?? DEFAULT_RECONNECT_MIN_DELAY_MS;
    this.reconnectMaxDelayMs = options.reconnect?.maxDelayMs ?? DEFAULT_RECONNECT_MAX_DELAY_MS;
    this.reconnectMaxAttempts = options.reconnect?.maxAttempts ?? DEFAULT_RECONNECT_MAX_ATTEMPTS;
  }

  get connectionState(): ConnectionState {
    return this.state;
  }

  get isExtensionConnected(): boolean {
    return this.extensionConnected;
  }

  onCdpResult(callback: CdpResultCallback): () => void {
    this.cdpResultCallbacks.add(callback);
    return () => {
      this.cdpResultCallbacks.delete(callback);
    };
  }

  async connect(): Promise<void> {
    if (this.isSocketReady()) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    const WebSocketCtor = globalThis.WebSocket;
    if (!WebSocketCtor) {
      throw new Error("WebSocket is not available in this runtime");
    }

    this.shouldReconnect = true;
    this.clearReconnectTimer();
    this.state = "connecting";
    this.authenticated = false;

    const socket = new WebSocketCtor(this.relayUrl);
    this.ws = socket;

    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.connectResolve = () => {
        resolve();
        this.clearPendingConnectState();
      };
      this.connectReject = (error) => {
        reject(error);
        this.clearPendingConnectState();
      };

      this.connectTimeoutId = setTimeout(() => {
        this.rejectPendingConnect(new Error("Timed out connecting to browser relay"));
        this.closeSocket();
      }, this.connectTimeoutMs);
    });

    socket.addEventListener("open", this.handleSocketOpen);
    socket.addEventListener("message", this.handleSocketMessage);
    socket.addEventListener("close", this.handleSocketClose);
    socket.addEventListener("error", this.handleSocketError);

    return this.connectPromise;
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.failAllPendingCommands(new Error("Browser relay disconnected"));
    this.rejectPendingConnect(new Error("Browser relay disconnected"));
    this.closeSocket();
    this.state = "disconnected";
    this.authenticated = false;
    this.extensionConnected = false;
  }

  async sendCdpCommand(
    method: string,
    params: Record<string, unknown> = {},
    options?: SendCdpCommandOptions
  ): Promise<unknown> {
    if (!method || typeof method !== "string") {
      throw new Error("CDP method is required");
    }

    if (!isRecord(params)) {
      throw new Error("CDP params must be an object");
    }

    await this.connect();

    const id = this.nextCommandId++;
    const timeoutMs = options?.timeoutMs ?? this.commandTimeoutMs;

    return new Promise<unknown>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingCommands.delete(id);
        reject(new Error(`Timed out waiting for CDP result (${method})`));
      }, timeoutMs);

      this.pendingCommands.set(id, {
        method,
        timeoutId,
        resolve,
        reject,
      });

      try {
        this.sendRaw({
          type: "cdp",
          id,
          method,
          params,
        });
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingCommands.delete(id);
        reject(asError(error, "Failed to send CDP command"));
      }
    });
  }

  private isSocketReady(): boolean {
    return (
      this.state === "connected" &&
      this.authenticated &&
      !!this.ws &&
      this.ws.readyState === WS_OPEN
    );
  }

  private sendRaw(message: BrowserRelayOutgoingMessage): void {
    if (!this.ws || this.ws.readyState !== WS_OPEN) {
      throw new Error("Browser relay socket is not open");
    }

    this.ws.send(JSON.stringify(message));
  }

  private closeSocket(): void {
    if (!this.ws) {
      return;
    }

    const socket = this.ws;
    socket.removeEventListener("open", this.handleSocketOpen);
    socket.removeEventListener("message", this.handleSocketMessage);
    socket.removeEventListener("close", this.handleSocketClose);
    socket.removeEventListener("error", this.handleSocketError);

    if (socket.readyState === WS_CONNECTING || socket.readyState === WS_OPEN) {
      socket.close();
    }

    this.ws = null;
  }

  private clearPendingConnectState(): void {
    this.connectResolve = null;
    this.connectReject = null;

    if (this.connectTimeoutId) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }

    this.connectPromise = null;
  }

  private resolvePendingConnect(): void {
    if (!this.connectResolve) {
      return;
    }
    const resolve = this.connectResolve;
    resolve();
  }

  private rejectPendingConnect(error: Error): void {
    if (!this.connectReject) {
      return;
    }
    const reject = this.connectReject;
    reject(error);
  }

  private failAllPendingCommands(error: Error): void {
    for (const [id, pending] of this.pendingCommands) {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
      this.pendingCommands.delete(id);
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || !this.reconnectEnabled) {
      return;
    }

    if (this.reconnectTimerId) {
      return;
    }

    if (this.reconnectAttempts >= this.reconnectMaxAttempts) {
      return;
    }

    const delay = Math.min(
      this.reconnectMinDelayMs * 2 ** this.reconnectAttempts,
      this.reconnectMaxDelayMs
    );

    this.reconnectAttempts += 1;
    this.reconnectTimerId = setTimeout(() => {
      this.reconnectTimerId = null;
      void this.connect().catch(() => {
        this.scheduleReconnect();
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimerId) {
      clearTimeout(this.reconnectTimerId);
      this.reconnectTimerId = null;
    }
  }

  private handleSocketOpen = (): void => {
    try {
      this.sendRaw({
        type: "auth",
        role: "agent",
        token: this.instanceSecret,
      });
    } catch (error) {
      this.rejectPendingConnect(asError(error, "Failed to authenticate browser relay socket"));
      this.closeSocket();
    }
  };

  private handleSocketMessage = (event: MessageEvent): void => {
    void this.processIncoming(event.data);
  };

  private handleSocketClose = (): void => {
    const wasConnected = this.state === "connected";
    const wasConnecting = this.state === "connecting";

    this.state = "disconnected";
    this.authenticated = false;
    this.extensionConnected = false;
    this.ws = null;

    if (wasConnecting) {
      this.rejectPendingConnect(new Error("Browser relay socket closed during authentication"));
    }

    this.failAllPendingCommands(new Error("Browser relay connection closed"));

    if (wasConnected) {
      this.scheduleReconnect();
    }
  };

  private handleSocketError = (): void => {
    if (this.state === "connecting") {
      this.rejectPendingConnect(new Error("Browser relay socket error"));
    }
  };

  private async processIncoming(rawData: unknown): Promise<void> {
    const raw = await decodeMessageData(rawData);
    if (!raw) {
      return;
    }

    const message = parseIncomingMessage(raw);
    if (!message) {
      return;
    }

    switch (message.type) {
      case "auth_required":
        return;

      case "auth_success":
        this.state = "connected";
        this.authenticated = true;
        this.reconnectAttempts = 0;
        this.resolvePendingConnect();
        return;

      case "auth_error":
        this.rejectPendingConnect(new Error(message.error || "Browser relay authentication failed"));
        this.closeSocket();
        return;

      case "peer_status":
        if (typeof message.extensionConnected === "boolean") {
          this.extensionConnected = message.extensionConnected;
        }
        return;

      case "peer_connected":
        if (message.peer === "extension") {
          this.extensionConnected = true;
        }
        return;

      case "peer_disconnected":
        if (message.peer === "extension") {
          this.extensionConnected = false;
        }
        return;

      case "cdp_result":
        this.handleCdpResult(message);
        return;

      case "cdp_error":
        this.handleCdpError(message);
        return;

      case "error":
        // Relay errors are not command-scoped, so fail all pending commands.
        this.failAllPendingCommands(new Error(message.error || "Browser relay error"));
        return;

      case "ping":
        try {
          this.sendRaw({ type: "pong" });
        } catch {
          // Ignore ping response errors. Close handler will recover.
        }
        return;

      case "pong":
      case "cdp_event":
        return;

      default:
        return;
    }
  }

  private handleCdpResult(message: RelayCdpResultMessage): void {
    const pending = this.pendingCommands.get(message.id);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pendingCommands.delete(message.id);
      pending.resolve(message.result);
    }

    for (const callback of this.cdpResultCallbacks) {
      callback(message);
    }
  }

  private handleCdpError(message: RelayCdpErrorMessage): void {
    const error = new Error(message.error || "CDP command failed");
    const pending = this.pendingCommands.get(message.id);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pendingCommands.delete(message.id);
      pending.reject(error);
    }

    for (const callback of this.cdpResultCallbacks) {
      callback(message);
    }
  }
}

export function getSharedBrowserRelayClient(options: BrowserRelayClientOptions): BrowserRelayClient {
  cleanupSharedBrowserRelayClients();

  const key = getSharedClientKey(options.instanceId, options.instanceSecret);
  const now = Date.now();

  const existing = sharedClients.get(key);
  if (existing) {
    existing.lastUsedAt = now;
    return existing.client;
  }

  for (const [existingKey, entry] of sharedClients) {
    if (entry.instanceId === options.instanceId && existingKey !== key) {
      entry.client.disconnect();
      sharedClients.delete(existingKey);
    }
  }

  const client = new BrowserRelayClient(options);
  sharedClients.set(key, {
    instanceId: options.instanceId,
    instanceSecret: options.instanceSecret,
    client,
    lastUsedAt: now,
  });
  return client;
}

export function cleanupSharedBrowserRelayClients(now = Date.now()): void {
  for (const [key, entry] of sharedClients) {
    if (now - entry.lastUsedAt > SHARED_CLIENT_TTL_MS) {
      entry.client.disconnect();
      sharedClients.delete(key);
    }
  }
}
