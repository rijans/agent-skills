# Cloudflare Email Routing Workers Sources & References

This document lists canonical documentation, specifications, and package repositories for Cloudflare Email Routing Workers.

---

## 1. Official Documentation & Specifications

| Resource | Canonical URL | Description |
|---|---|---|
| **Email Routing Overview** | [developers.cloudflare.com/email-routing](https://developers.cloudflare.com/email-routing/) | Architecture, custom domain setup, DNS records (MX/SPF/DKIM), and routing rules. |
| **Email Workers Guide** | [developers.cloudflare.com/email-routing/email-workers](https://developers.cloudflare.com/email-routing/email-workers/) | `email(message, env, ctx)` handler lifecycle, parameters, and action methods. |
| **Email Workers API Reference** | [developers.cloudflare.com/email-routing/email-workers/runtime-api](https://developers.cloudflare.com/email-routing/email-workers/runtime-api/) | `ForwardableEmailMessage`, `message.forward()`, `message.reply()`, and `message.setReject()`. |
| **Send Email Binding** | [developers.cloudflare.com/email-routing/email-workers/send-email-workers](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/) | `send_email` configuration, `cloudflare:email` module, and `EmailMessage` class. |

---

## 2. Recommended Isolate-Native Libraries

| Package | Repository / URL | Purpose |
|---|---|---|
| **`postal-mime`** | [github.com/postalsys/postal-mime](https://github.com/postalsys/postal-mime) | Zero-dependency, V8 isolate-compatible RFC 5322 / MIME parser for `message.raw`. |
| **`mimetext`** | [github.com/muratgozel/mimetext](https://github.com/muratgozel/mimetext) | RFC 5322 MIME message generator for multipart text, HTML, and threaded replies. |

---

## 3. RFC Standards

- **RFC 5322**: Internet Message Format (Message-ID, In-Reply-To, References, Subject, Date, Headers).
- **RFC 2045 / RFC 2046**: Multipurpose Internet Mail Extensions (MIME) parts and boundaries.
- **RFC 3834**: Recommendations for Automatic Responses to Electronic Mail (`Auto-Submitted` header).
