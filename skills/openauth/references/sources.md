# OpenAuth Sources & Canonical References

This document lists canonical documentation, specifications, and package endpoints for OpenAuth (`@openauthjs/openauth`).

---

## 1. Official Documentation & Repositories

| Resource | Canonical URL | Description |
|---|---|---|
| **Official Docs** | [openauth.js.org](https://openauth.js.org) | Guides, provider lists, UI customization, client SDK, and deployment references. |
| **GitHub Repository** | [github.com/openauthjs/openauth](https://github.com/openauthjs/openauth) | Source code, provider implementations, storage drivers, issues, and releases. |
| **SST Overview** | [sst.dev/docs/auth](https://sst.dev) | Architecture notes on zero-config self-hosted authentication by the SST team. |
| **NPM Package** | [npmjs.com/package/@openauthjs/openauth](https://www.npmjs.com/package/@openauthjs/openauth) | Core package distribution. |

---

## 2. Package Module Exports Reference

`@openauthjs/openauth` uses clean subpath exports:

- `@openauthjs/openauth`: Exports central `issuer()` function.
- `@openauthjs/openauth/subject`: Exports `createSubjects()` for typed claims.
- `@openauthjs/openauth/client`: Exports `createClient()` for authorization, exchange, and verification.
- `@openauthjs/openauth/provider/*`:
  - `.../provider/password`: `PasswordProvider`
  - `.../provider/code`: `CodeProvider`
  - `.../provider/github`: `GithubProvider`
  - `.../provider/google`: `GoogleProvider`, `GoogleOidcProvider`
  - `.../provider/discord`: `DiscordProvider`
  - `.../provider/oidc`: Generic OIDC provider
- `@openauthjs/openauth/ui/*`:
  - `.../ui/password`: `PasswordUI`
  - `.../ui/code`: `CodeUI`
- `@openauthjs/openauth/storage/*`:
  - `.../storage/memory`: `MemoryStorage` (development only)
  - `.../storage/cloudflare`: `CloudflareStorage` (Cloudflare KV for Workers)
  - `.../storage/dynamo`: `DynamoStorage` (AWS DynamoDB)

---

## 3. Standard Schema Specification

OpenAuth's `createSubjects()` is built on the [Standard Schema](https://standardschema.dev) initiative:
- Supported libraries: **Valibot** (`valibot` v1.0.0+), **Zod** (`zod` v3.24.0+), and **ArkType**.
- Guarantees zero lock-in to a specific validation library and keeps token serialization lightweight and tree-shakeable.
