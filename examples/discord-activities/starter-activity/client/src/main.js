import { DiscordSDK } from "@discord/embedded-app-sdk";

// Client ID from environment or fallback
const CLIENT_ID = import.meta.env?.VITE_DISCORD_CLIENT_ID || "123456789012345678";

// Instantiate the SDK
const discordSdk = new DiscordSDK(CLIENT_ID);

function getApiUrl(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined" && window.location.hostname.endsWith("discordsays.com")) {
    return `/.proxy${cleanPath}`;
  }
  return cleanPath;
}

function isEmbeddedInDiscord() {
  return typeof window !== "undefined" && window.location.search.includes("frame_id=");
}

async function authenticateWithDiscord() {
  const statusEl = document.getElementById("status-badge");
  const userEl = document.getElementById("username");
  const channelEl = document.getElementById("channel-info");
  const avatarEl = document.getElementById("avatar");

  // 1. Fallback for testing in browser without opening Discord client
  if (!isEmbeddedInDiscord()) {
    console.warn("Running outside Discord. Activating mock browser session.");
    if (statusEl) statusEl.textContent = "Local Mock Mode";
    if (userEl) userEl.textContent = "LocalDevUser";
    if (channelEl) channelEl.textContent = "Channel: #voice-general (Mock)";
    return { user: { username: "LocalDevUser", id: "9990001" } };
  }

  // 2. Await RPC Handshake
  if (statusEl) statusEl.textContent = "Handshaking RPC...";
  await discordSdk.ready();

  if (channelEl) {
    channelEl.textContent = `Channel ID: ${discordSdk.channelId || "Direct Message"}`;
  }

  // 3. Request OAuth2 Code from Discord Client
  if (statusEl) statusEl.textContent = "Authorizing...";
  const { code } = await discordSdk.commands.authorize({
    client_id: CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds", "guilds.members.read"],
  });

  // 4. Send code to backend via /.proxy/api/token
  if (statusEl) statusEl.textContent = "Exchanging Token...";
  const tokenRes = await fetch(getApiUrl("/api/token"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed: ${tokenRes.statusText}`);
  }

  const { access_token } = await tokenRes.json();

  // 5. Finalize authentication
  const auth = await discordSdk.commands.authenticate({ access_token });

  if (statusEl) {
    statusEl.textContent = "Connected & Ready";
    statusEl.style.background = "#23a55a";
  }

  if (userEl && auth?.user) {
    userEl.textContent = auth.user.global_name || auth.user.username;
  }

  if (avatarEl && auth?.user) {
    if (auth.user.avatar) {
      avatarEl.src = `https://cdn.discordapp.com/avatars/${auth.user.id}/${auth.user.avatar}.png?size=128`;
    }
  }

  return auth;
}

// Attach UI event listener
document.getElementById("ping-btn")?.addEventListener("click", () => {
  alert(`Activity is running! Platform: ${discordSdk.platform || "browser"}`);
});

// Run setup on page load
authenticateWithDiscord().catch((err) => {
  console.error("Discord Activity initialization failed:", err);
  const statusEl = document.getElementById("status-badge");
  if (statusEl) {
    statusEl.textContent = "Connection Error";
    statusEl.style.background = "#da373c";
  }
});
