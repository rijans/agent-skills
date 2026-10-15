# Multiplayer State Synchronization

This reference explains how to implement real-time multiplayer synchronization for Discord Activities.

---

## 1. The Discord SDK State Boundary

A common misconception is that `@discord/embedded-app-sdk` synchronizes game state or custom application data between clients. It does not:
- The Discord SDK provides **voice presence and user metadata**, not a generic message bus.
- To synchronize game boards, player scores, canvas drawings, or chat messages across players in the same voice channel, you must connect clients to a **dedicated WebSocket server or room service**.

---

## 2. Using `instanceId` as the Room Identifier

Every launch of an Activity in a channel shares a unique `discordSdk.instanceId`. Use this ID as your multiplayer room key:

```typescript
// All players in the same voice channel session share this exact instanceId
const roomId = discordSdk.instanceId;
```

---

## 3. Lightweight WebSocket Room Server (Node.js & `ws`)

A complete room-based multiplayer server:

```typescript
// server/src/multiplayer.ts
import { WebSocketServer, WebSocket } from "ws";

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  roomId: string;
}

const rooms = new Map<string, Set<ClientConnection>>();

export function setupMultiplayerServer(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    let client: ClientConnection | null = null;

    ws.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());

        // 1. Client joins a room by Discord instanceId
        if (message.type === "JOIN_ROOM") {
          const { roomId, userId } = message;
          client = { ws, userId, roomId };

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
          }
          rooms.get(roomId)!.add(client);

          // Broadcast player joined to room
          broadcastToRoom(roomId, {
            type: "PLAYER_JOINED",
            userId,
            totalPlayers: rooms.get(roomId)!.size,
          });
          return;
        }

        // 2. Broadcast application/game action to everyone else in the room
        if (client && message.type === "GAME_ACTION") {
          broadcastToRoom(
            client.roomId,
            { type: "GAME_ACTION", userId: client.userId, payload: message.payload },
            ws // exclude sender
          );
        }
      } catch (err) {
        console.error("Malformed message:", err);
      }
    });

    ws.on("close", () => {
      if (client && rooms.has(client.roomId)) {
        const room = rooms.get(client.roomId)!;
        room.delete(client);
        if (room.size === 0) {
          rooms.delete(client.roomId);
        } else {
          broadcastToRoom(client.roomId, {
            type: "PLAYER_LEFT",
            userId: client.userId,
            totalPlayers: room.size,
          });
        }
      }
    });
  });
}

function broadcastToRoom(roomId: string, data: any, excludeWs?: WebSocket) {
  const room = rooms.get(roomId);
  if (!room) return;

  const payload = JSON.stringify(data);
  for (const client of room) {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}
```

---

## 4. Frontend Client Connection & Reconciliation

```typescript
// client/src/multiplayer.ts
import { DiscordSDK } from "@discord/embedded-app-sdk";

export class MultiplayerClient {
  private ws: WebSocket | null = null;

  connect(discordSdk: DiscordSDK, userId: string, onAction: (action: any) => void) {
    // Connect to WebSocket server through secure proxy or wss://
    const wsUrl = `wss://${window.location.host}/.proxy/ws`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      // Announce presence in this activity instance
      this.ws?.send(
        JSON.stringify({
          type: "JOIN_ROOM",
          roomId: discordSdk.instanceId,
          userId,
        })
      );
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      onAction(msg);
    };
  }

  sendAction(payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "GAME_ACTION", payload }));
    }
  }
}
```
