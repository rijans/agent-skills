# Local Development and Tunneling

This reference details the hybrid workflow for building and testing Discord Activities: fast browser mock mode for UI iteration, and Cloudflare Tunnel (`cloudflared`) for testing inside the live Discord client.

---

## 1. The Local Development Dilemma

Discord Activities execute inside an iframe loaded by the Discord client over **strict HTTPS**.
- Discord cannot load `http://localhost:5173` directly because of mixed-content security policies.
- Therefore, testing in Discord requires an **HTTPS tunnel** pointing to your local development machine.
- However, opening the Discord client and launching an Activity on every code change is slow.

### The Hybrid Solution

1. **Phase 1: Local Mock Mode** (90% of development): Run in your regular web browser with mock Discord context to rapidly build UI, components, and game logic.
2. **Phase 2: Live Tunnel Mode** (10% of development): Expose your dev server via Cloudflare Tunnel (`cloudflared`) to test the real Discord RPC handshake, OAuth2 exchange, voice presence, and CSP proxying.

---

## 2. Setting Up Cloudflare Tunnel (`cloudflared`)

Cloudflare Tunnels provide free, stable, zero-config HTTPS endpoints for localhost:

### Step 1: Install `cloudflared`

```bash
# macOS (Homebrew)
brew install cloudflared

# Linux (Debian/Ubuntu)
sudo apt-get install cloudflared

# Windows (Winget)
winget install Cloudflare.cloudflared
```

### Step 2: Start Tunnel to Local Vite Dev Server

```bash
cloudflared tunnel --url http://localhost:5173
```

Output:
```text
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://curly-orange-apples.trycloudflare.com                                             |
+--------------------------------------------------------------------------------------------+
```

---

## 3. Configuring the Discord Developer Portal

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) $\rightarrow$ Your Application.
2. Navigate to **Activities** $\rightarrow$ **General**.
3. Under **URL Mappings**:
   - Set the mapping prefix `/.proxy/api` to `https://curly-orange-apples.trycloudflare.com/api`.
4. Under **Activity URL** (or Client Origin):
   - Set to your tunnel URL: `https://curly-orange-apples.trycloudflare.com`.
5. Save Changes.

Now, when you click the 🚀 Rocket button in any Discord voice channel or DM where your bot/app is installed, Discord will load your local Vite server!

---

## 4. Vite Configuration with Backend Proxy

To run your frontend and backend on one local port seamlessly:

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // Forward local /.proxy/api calls to backend server running on port 3000
      "/.proxy/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/\.proxy/, ""),
      },
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

---

## 5. Offline Browser Mock Helper

Detect when running outside Discord to avoid crashing on `discordSdk.ready()`:

```typescript
export function isDiscordEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("frame_id");
}

export function createMockDiscordSession() {
  return {
    user: {
      id: "9990001",
      username: "LocalDeveloper",
      discriminator: "0001",
      avatar: null,
    },
    channelId: "1234567890",
    guildId: "9876543210",
  };
}
```
