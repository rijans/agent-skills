# OpenAuth Hono Web Client Example

This example demonstrates an SSR web client built in Hono that integrates with an OpenAuth server.

## Features
- Initiates authorization code redirects via `authClient.authorize()`
- Handles OAuth2 callback and code exchange via `authClient.exchange()`
- Stores access and refresh tokens in HTTP-only cookies
- Protects private routes and handles **token refresh rotation** via `authClient.verify()`

## Quickstart

```bash
npm install
npm start
```

Visit `http://localhost:3001` to test the sign-in and token rotation flow.
