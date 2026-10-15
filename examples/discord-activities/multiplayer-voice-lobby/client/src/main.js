import { DiscordSDK, Events } from "@discord/embedded-app-sdk";

const CLIENT_ID = import.meta.env?.VITE_DISCORD_CLIENT_ID || "123456789012345678";
const discordSdk = new DiscordSDK(CLIENT_ID);

let currentUser = null;
let activeParticipants = [];
let speakingUsers = new Set();
let ws = null;
let currentCount = 0;

function isEmbedded() {
  return typeof window !== "undefined" && window.location.search.includes("frame_id=");
}

function getApiUrl(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined" && window.location.hostname.endsWith("discordsays.com")) {
    return `/.proxy${cleanPath}`;
  }
  return cleanPath;
}

function renderParticipants() {
  const listEl = document.getElementById("participant-list");
  const countEl = document.getElementById("user-count");
  if (!listEl) return;

  if (countEl) countEl.textContent = String(activeParticipants.length);
  listEl.innerHTML = "";

  activeParticipants.forEach((p) => {
    const isSpeaking = speakingUsers.has(p.id);
    const chip = document.createElement("div");
    chip.className = `participant-chip ${isSpeaking ? "speaking" : ""}`;

    const avatarUrl = p.avatar
      ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png?size=64`
      : `https://cdn.discordapp.com/embed/avatars/0.png`;

    chip.innerHTML = `
      <img class="chip-avatar" src="${avatarUrl}" alt="${p.username}" />
      <span class="chip-name">${p.global_name || p.username}</span>
    `;
    listEl.appendChild(chip);
  });
}

function setupWebSocket(roomId, userId) {
  const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProto}//${window.location.host}${getApiUrl("/ws")}`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "JOIN_ROOM", roomId, userId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "SYNC_STATE") {
          currentCount = msg.count || 0;
          const displayEl = document.getElementById("shared-count");
          if (displayEl) displayEl.textContent = String(currentCount);
        }
      } catch (err) {
        console.error("WebSocket message parse error:", err);
      }
    };
  } catch (err) {
    console.warn("WebSocket connection skipped in offline mode:", err);
  }
}

async function startLobby() {
  const roomEl = document.getElementById("room-id");

  // Local mock mode fallback
  if (!isEmbedded()) {
    currentUser = { id: "9990001", username: "LocalTester" };
    activeParticipants = [currentUser, { id: "9990002", username: "VoiceBuddy" }];
    if (roomEl) roomEl.textContent = "Room: mock-voice-lobby";
    renderParticipants();
    return;
  }

  // 1. Ready Handshake
  await discordSdk.ready();

  const roomId = discordSdk.instanceId || "default-room";
  if (roomEl) roomEl.textContent = `Instance: ${roomId.slice(0, 8)}...`;

  // 2. Authorize & Authenticate
  const { code } = await discordSdk.commands.authorize({
    client_id: CLIENT_ID,
    response_type: "code",
    prompt: "none",
    scope: ["identify", "guilds.members.read"],
  });

  const res = await fetch(getApiUrl("/api/token"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const { access_token } = await res.json();
  const auth = await discordSdk.commands.authenticate({ access_token });
  currentUser = auth.user;

  // 3. Initial Participants Fetch
  const initial = await discordSdk.commands.getInstanceConnectedParticipants();
  activeParticipants = initial.participants || [];
  renderParticipants();

  // 4. Subscribe to Participant Changes
  await discordSdk.subscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, ({ participants }) => {
    activeParticipants = participants || [];
    renderParticipants();
  });

  // 5. Subscribe to Speaking Indicators
  if (discordSdk.channelId) {
    await discordSdk.subscribe(Events.SPEAKING_START, ({ user_id }) => {
      speakingUsers.add(user_id);
      renderParticipants();
    }, { channel_id: discordSdk.channelId });

    await discordSdk.subscribe(Events.SPEAKING_STOP, ({ user_id }) => {
      speakingUsers.delete(user_id);
      renderParticipants();
    }, { channel_id: discordSdk.channelId });
  }

  // 6. Connect Real-time Room WebSocket
  setupWebSocket(roomId, currentUser.id);
}

document.getElementById("tap-btn")?.addEventListener("click", () => {
  currentCount += 1;
  const displayEl = document.getElementById("shared-count");
  if (displayEl) displayEl.textContent = String(currentCount);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "INCREMENT", count: currentCount }));
  }
});

startLobby().catch(console.error);
