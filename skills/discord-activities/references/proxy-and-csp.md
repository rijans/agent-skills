# Proxy Routing and Content Security Policy (`/.proxy/`)

This reference explains how Discord's sandboxed reverse proxy (`/.proxy/`) works, how to configure URL Mappings in the Developer Portal, and how to verify proxy signatures.

---

## 1. Why Discord Uses a Reverse Proxy

When users launch an Activity, Discord loads your application inside a sandboxed iframe served from:

```text
https://<YOUR_APPLICATION_ID>.discordsays.com
```

To protect user safety and prevent unauthorized data exfiltration, Discord enforces a strict **Content Security Policy (CSP)** on `discordsays.com`:
- **Direct external requests are blocked**: Calling `fetch("https://my-backend-server.com/api")` triggers a CSP violation in the browser console (`Refused to connect to... because it violates the following Content Security Policy directive...`).
- **All backend traffic must route through `/.proxy/`**: Discord intercepts requests starting with `/.proxy/` and forwards them securely through its internal infrastructure to your target backend.

---

## 2. Configuring URL Mappings in Discord Developer Portal

To map `/.proxy/` requests to your actual server:

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select your Application and navigate to **Activities** $\rightarrow$ **URL Mappings**.
3. Add a mapping:
   - **Prefix**: `/.proxy/api` (or `/.proxy/`)
   - **Target**: `https://your-backend-domain.com/api` (or your Cloudflare Tunnel URL during dev)
4. Save Changes.

```text
Browser fetch:      /.proxy/api/token
                        │
                        ▼ (Discord Proxy Infrastructure)
Forwarded to:       https://your-backend-domain.com/api/token
```

---

## 3. Dynamic Prefix Helper in Frontend

During local development with a local mock or proxy, you might fetch directly from `/api`, but in production on Discord you must fetch from `/.proxy/api`:

```typescript
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // If running inside Discord iframe, route through /.proxy
  if (typeof window !== "undefined" && window.location.hostname.endsWith("discordsays.com")) {
    return `/.proxy${cleanPath}`;
  }

  // Local development fallback
  return cleanPath;
}

// Usage:
const response = await fetch(getApiUrl("/api/token"), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code }),
});
```

---

## 4. Cryptographic Proxy Header Verification (Ed25519)

When Discord's proxy forwards an HTTP request to your backend, it appends signature headers:
- `X-Signature-Ed25519`: Hex-encoded Ed25519 signature.
- `X-Signature-Timestamp`: Unix timestamp of the request.

Your backend can verify that requests were genuinely routed through Discord using your Application's **Public Key** (found on the **General Information** page in the Discord Developer Portal):

```typescript
import { subtle } from "node:crypto";

export async function verifyDiscordProxyRequest(
  bodyText: string,
  signatureHex: string | null,
  timestamp: string | null,
  publicKeyHex: string
): Promise<boolean> {
  if (!signatureHex || !timestamp) return false;

  // Prevent replay attacks (allow 5-minute clock drift)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return false;
  }

  try {
    const pubKey = await subtle.importKey(
      "raw",
      Buffer.from(publicKeyHex, "hex"),
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    const message = Buffer.from(timestamp + bodyText);
    const signature = Buffer.from(signatureHex, "hex");

    return await subtle.verify("Ed25519", pubKey, signature, message);
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}
```
