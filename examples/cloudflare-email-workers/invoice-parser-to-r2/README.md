# Cloudflare Email Worker: Invoice Parser to R2

An inbound email processing Worker that parses email attachments with `postal-mime` and uploads PDF/image invoices to Cloudflare R2 object storage.

## Features
- Inbound raw stream parsing via `postal-mime`
- Memory overflow defense (`message.rawSize`)
- Direct binary uploading to Cloudflare R2 bucket with custom metadata

## Deploying

```bash
npm install
npx wrangler r2 bucket create inbound-invoices
npx wrangler deploy
```

Then attach the Worker to an Email Routing Rule in the Cloudflare Dashboard.
