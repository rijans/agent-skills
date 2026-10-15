# Authoritative Sources & Upstream Specifications

This reference lists the official, authoritative upstream documentation, SDK repositories, and developer portal guides for Discord Activities.

---

## 1. Official Documentation & Specifications

- **[Discord Activities Overview](https://discord.com/developers/docs/activities/overview)**: Architectural overview of Discord Activities, iframe sandboxing, and runtime environments.
- **[Building an Activity Guide](https://discord.com/developers/docs/activities/building-an-activity)**: Step-by-step setup, OAuth2 authorization loop, and client-server token exchange.
- **[Development Guides & Proxy Routing](https://discord.com/developers/docs/activities/development-guides#using-a-proxy)**: Content Security Policy (CSP), URL Mappings, and `/.proxy/` request forwarding.
- **[Discord In-App Purchases & SKUs](https://discord.com/developers/docs/monetization/overview)**: Monetization documentation covering Durable, Consumable, and Subscription SKUs with `startPurchase`.

---

## 2. Official SDK & Package Repositories

- **[`@discord/embedded-app-sdk` on npm](https://www.npmjs.com/package/@discord/embedded-app-sdk)**: Official client library for initializing the RPC connection, executing commands, and subscribing to events.
- **[`discord/embedded-app-sdk` on GitHub](https://github.com/discord/embedded-app-sdk)**: Source repository, TypeScript definitions, examples, and release changelogs.

---

## 3. Tooling & Development Tunnels

- **[Discord Developer Portal](https://discord.com/developers/applications)**: Where applications, Client IDs, Client Secrets, URL Mappings, and SKUs are managed.
- **[Cloudflare Tunnel (`cloudflared`)](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)**: Free, zero-configuration HTTPS tunneling for local Vite development servers.
- **[Hono Framework](https://hono.dev/)**: Multi-runtime TypeScript server framework running on Node.js, Bun, and Cloudflare Workers.
