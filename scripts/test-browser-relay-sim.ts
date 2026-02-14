#!/usr/bin/env npx tsx

import { WebSocketServer, WebSocket } from "ws";
import { BrowserRelayClient } from "../apps/web/src/lib/browser-relay-client.ts";

type Role = "agent" | "extension";
type RelaySocket = WebSocket & { role?: Role; authenticated?: boolean };

const ROOM_ID = "test-room-1";
const EXT_TOKEN = "brc_test_local";
const AGENT_SECRET = "agent_secret_local";

function asText(data: WebSocket.RawData): string {
  if (typeof data === "string") {
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  return Buffer.from(data as ArrayBuffer).toString("utf8");
}

async function main() {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => {
    wss.once("listening", () => resolve());
  });
  const address = wss.address();
  const port = typeof address === "object" && address ? address.port : 0;
  if (!port) {
    throw new Error("Failed to allocate test websocket port");
  }

  let extensionSocket: RelaySocket | null = null;
  let agentSocket: RelaySocket | null = null;

  wss.on("connection", (socket: RelaySocket, req) => {
    const url = req.url || "";
    if (!url.endsWith(`/${ROOM_ID}`)) {
      socket.close(1008, "wrong room");
      return;
    }

    socket.send(JSON.stringify({ type: "auth_required" }));

    socket.on("message", (raw) => {
      const payload = JSON.parse(asText(raw)) as Record<string, unknown>;
      if (payload.type === "auth") {
        const role = payload.role === "agent" ? "agent" : payload.role === "extension" ? "extension" : null;
        const token = typeof payload.token === "string" ? payload.token : "";

        if (!role || !token) {
          socket.send(JSON.stringify({ type: "auth_error", error: "missing auth payload" }));
          return;
        }

        if (role === "agent" && token !== AGENT_SECRET) {
          socket.send(JSON.stringify({ type: "auth_error", error: "invalid agent secret" }));
          return;
        }
        if (role === "extension" && token !== EXT_TOKEN) {
          socket.send(JSON.stringify({ type: "auth_error", error: "invalid extension token" }));
          return;
        }

        socket.role = role;
        socket.authenticated = true;
        if (role === "agent") {
          agentSocket = socket;
        } else {
          extensionSocket = socket;
        }

        socket.send(JSON.stringify({ type: "auth_success", role, roomId: ROOM_ID }));
        if (role === "agent") {
          socket.send(JSON.stringify({ type: "peer_status", extensionConnected: !!extensionSocket }));
        } else {
          socket.send(JSON.stringify({ type: "peer_status", agentConnected: !!agentSocket }));
        }
        return;
      }

      if (!socket.authenticated || !socket.role) {
        socket.send(JSON.stringify({ type: "error", error: "Not authenticated" }));
        return;
      }

      if (socket.role === "agent") {
        if (!extensionSocket || !extensionSocket.authenticated) {
          socket.send(JSON.stringify({ type: "error", error: "Extension not connected" }));
          return;
        }
        extensionSocket.send(JSON.stringify(payload));
      } else if (agentSocket && agentSocket.authenticated) {
        agentSocket.send(JSON.stringify(payload));
      }
    });

    socket.on("close", () => {
      if (socket === extensionSocket) {
        extensionSocket = null;
      }
      if (socket === agentSocket) {
        agentSocket = null;
      }
    });
  });

  const extensionClient = new WebSocket(`ws://127.0.0.1:${port}/parties/main/${ROOM_ID}`);
  extensionClient.on("message", (raw) => {
    const message = JSON.parse(asText(raw)) as Record<string, unknown>;
    if (message.type === "auth_required") {
      extensionClient.send(
        JSON.stringify({
          type: "auth",
          role: "extension",
          token: EXT_TOKEN,
        })
      );
      return;
    }

    if (message.type === "cdp" && typeof message.id === "number") {
      extensionClient.send(
        JSON.stringify({
          type: "cdp_result",
          id: message.id,
          result: {
            ok: true,
            method: message.method,
            echoedParams: message.params || {},
          },
        })
      );
    }
  });

  await new Promise<void>((resolve, reject) => {
    extensionClient.once("open", () => resolve());
    extensionClient.once("error", (err) => reject(err));
  });

  const client = new BrowserRelayClient({
    instanceId: ROOM_ID,
    instanceSecret: AGENT_SECRET,
    relayBaseUrl: `ws://127.0.0.1:${port}/parties/main`,
    reconnect: { enabled: false },
  });

  const result = await client.sendCdpCommand("Runtime.evaluate", {
    expression: "1 + 1",
  });

  const output = result as { ok?: boolean; method?: string };
  if (!output || output.ok !== true || output.method !== "Runtime.evaluate") {
    throw new Error(`Unexpected relay result: ${JSON.stringify(result)}`);
  }

  client.disconnect();
  extensionClient.close();
  await new Promise((resolve) => wss.close(resolve));
  console.log("Browser relay simulation test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
