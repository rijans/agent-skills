import { createClient } from "@openauthjs/openauth/client";

export const authClient = createClient({
  clientID: "web-client-example",
  issuer: process.env.AUTH_ISSUER_URL || "http://localhost:3000",
});
