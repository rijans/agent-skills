# Cloudflare Email Worker: Auto-Reply Agent

An automated email auto-responder for Cloudflare Email Routing with RFC 3834 loop protection and RFC 5322 conversation threading.

## Features
- Inspects `Auto-Submitted`, `Precedence`, and automated sender patterns to prevent infinite auto-responder loops.
- Builds RFC 5322 compliant threaded replies using `mimetext` (`In-Reply-To`, `References`, `Re: ` subject).
- Sends replies using `cloudflare:email` and `message.reply()`.

## Deploying

```bash
npm install
npx wrangler deploy
```

Then attach the Worker to an Email Routing Rule in your Cloudflare Dashboard.
