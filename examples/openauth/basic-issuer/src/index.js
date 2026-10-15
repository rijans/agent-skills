import { serve } from "@hono/node-server";
import { issuer } from "@openauthjs/openauth";
import { CodeProvider } from "@openauthjs/openauth/provider/code";
import { CodeUI } from "@openauthjs/openauth/ui/code";
import { PasswordProvider } from "@openauthjs/openauth/provider/password";
import { PasswordUI } from "@openauthjs/openauth/ui/password";
import { GithubProvider } from "@openauthjs/openauth/provider/github";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { subjects } from "./subjects.js";

// Configured OpenAuth Issuer Hono Application
export const app = issuer({
  subjects,
  storage: MemoryStorage(),
  providers: {
    code: CodeProvider(
      CodeUI({
        async sendCode(claims, code) {
          console.log(`[AUTH CODE] Sending OTP ${code} to ${claims.email}`);
        },
      })
    ),
    password: PasswordProvider(
      PasswordUI({
        async sendCode(email, code) {
          console.log(`[PASSWORD RESET] Code ${code} sent to ${email}`);
        },
      })
    ),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: GithubProvider({
            clientID: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        }
      : {}),
  },
  async success(ctx, value) {
    if (value.provider === "code" || value.provider === "password") {
      const email = value.claims?.email || "unknown@example.com";
      return ctx.subject("user", {
        userID: `usr_${Buffer.from(email).toString("hex").slice(0, 8)}`,
        email,
      });
    }

    if (value.provider === "github") {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${value.tokenset.access}`,
          "User-Agent": "OpenAuth-Basic-Issuer",
        },
      });
      const ghUser = await res.json();
      const email = ghUser.email || `${ghUser.login}@users.noreply.github.com`;
      return ctx.subject("user", {
        userID: `gh_${ghUser.id}`,
        email,
      });
    }

    throw new Error(`Unsupported provider: ${value.provider}`);
  },
});

const PORT = Number(process.env.PORT) || 3000;

if (process.env.NODE_ENV !== "test") {
  console.log(`OpenAuth issuer running at http://localhost:${PORT}`);
  serve({ fetch: app.fetch, port: PORT });
}
