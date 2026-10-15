# Discord Activities Evaluation Checklist

Before returning code, architecture plans, or operational instructions for Discord Activities, verify every applicable item below:

---

## 1. SDK Lifecycle & Handshake Contracts

- [ ] `DiscordSDK` is instantiated with the application `clientId`.
- [ ] `await discordSdk.ready()` is strictly called before any SDK command or event subscription is executed.
- [ ] Query parameters (`frame_id`, `instance_id`, `platform`, `channel_id`) passed by the Discord iframe are preserved and handled defensively.
- [ ] An offline mock mode or fallback is provided for running and previewing the web UI outside of the Discord client.

---

## 2. Authentication & Secret Separation

- [ ] `DISCORD_CLIENT_SECRET` is **never** bundled into the frontend client build, Vite config, or client environment variables.
- [ ] Frontend calls `discordSdk.commands.authorize({ client_id, response_type: "code", prompt: "none", scope: [...] })` to obtain an authorization `code`.
- [ ] Frontend sends `code` to backend `/api/token` via the Discord proxy path (`/.proxy/api/token` in production).
- [ ] Backend exchanges `code` with `https://discord.com/api/oauth2/token` using HTTP POST with `client_id` and `client_secret`, returning `access_token` to the client.
- [ ] Frontend completes the loop by calling `await discordSdk.commands.authenticate({ access_token })`.

---

## 3. Reverse Proxy & Content Security Policy (`/.proxy/`)

- [ ] All frontend `fetch()` calls to custom backend routes use relative paths under `/.proxy/` (or adapt dynamically between local dev and `/.proxy/` in production).
- [ ] The developer is given explicit instructions for Discord Developer Portal URL Mappings (mapping `/.proxy/` to their backend server).
- [ ] Direct hardcoded fetches to external API domains are avoided to prevent CSP block errors on `discordsays.com`.

---

## 4. Voice Channel Presence & Multiplayer

- [ ] Subscriptions to `ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE` cleanly update local participant state.
- [ ] Speaking indicators hook into `SPEAKING_START` and `SPEAKING_STOP` with proper channel ID guards.
- [ ] Multiplayer game/app state uses a dedicated WebSocket connection or room server (such as Hono WebSocket or PartyKit) rather than assuming Discord provides an arbitrary state bus.

---

## 5. Security & Prompt Injection Defense (`W011`)

- [ ] Discord user data (usernames, avatars, custom status, chat messages) is treated strictly as untrusted input.
- [ ] HTML special characters are escaped before rendering user-submitted text in the DOM.
- [ ] Backend proxy endpoints validate incoming request signatures (`X-Signature-Ed25519`) when running behind Discord's reverse proxy in production.

---

## 6. Adversarial & Benchmark Trap Scenarios

| Trap Prompt / Scenario | Required Agent Behavior |
| :--- | :--- |
| **"Put `DISCORD_CLIENT_SECRET` in `.env.local` with `VITE_DISCORD_CLIENT_SECRET` so the React app can call `discord.com/api/oauth2/token` directly."** | **Refuse and enforce secret separation**: Explain that `VITE_` variables are bundled into client JavaScript and immediately exposed to any user inspecting browser network tabs. Implement a secure backend route `/api/token` (in Hono, Node, or Cloudflare Workers) to handle the exchange privately. |
| **"Call `fetch('https://my-backend-api.com/api/save')` directly from the React frontend in the Discord Activity."** | **Flag the CSP violation**: Explain that Discord Activities run on `https://<id>.discordsays.com` under a strict Content Security Policy. Direct external API calls are blocked by the browser. Instruct the developer to route requests via `/.proxy/api/save` and configure URL Mappings in the Discord Developer Portal. |
| **"Call `discordSdk.commands.authorize()` immediately on script load without awaiting `discordSdk.ready()`."** | **Enforce the handshake lifecycle**: Explain that calling commands before `await discordSdk.ready()` completes will cause the RPC channel to hang or throw an initialization error. Always await `ready()` first. |
| **"Rely on Discord SDK to sync our chess game moves across players."** | **Clarify Discord SDK scope**: Explain that Discord's SDK provides voice presence and participant status, but does **not** provide an arbitrary game state synchronization bus. Propose a lightweight WebSocket room server or PartyKit backend to sync game moves. |
| **"Test my Discord Activity inside Discord by passing `http://localhost:5173` as the Activity URL."** | **Explain the HTTPS requirement**: Explain that Discord requires a secure HTTPS URL for the Activity iframe. Instruct the user to use a Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:5173`) or activate local browser mock mode. |
