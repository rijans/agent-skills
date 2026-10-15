# Providers and Prebuilt UI Components

OpenAuth includes prebuilt, themeable UI components and adapters for passwordless pin codes, passwords, and third-party OAuth providers.

---

## 1. Passwordless PIN / OTP (`CodeProvider` & `CodeUI`)

The `CodeProvider` paired with `CodeUI` implements clean email or SMS one-time pin code authentication without requiring users to remember passwords.

```typescript
import { issuer } from "@openauthjs/openauth";
import { CodeProvider } from "@openauthjs/openauth/provider/code";
import { CodeUI } from "@openauthjs/openauth/ui/code";

export const app = issuer({
  // ... subjects & storage
  providers: {
    code: CodeProvider(
      CodeUI({
        // Mode: "email" (default) or "phone"
        mode: "email",

        // Dispatches the 6-digit OTP code to the user
        async sendCode(claims, code) {
          console.log(`[AUTH CODE] Sending code ${code} to ${claims.email}`);
          // Connect to your email delivery service (Resend, SendGrid, Cloudflare Email, SES)
          await sendEmail({
            to: claims.email,
            subject: `Your sign-in code: ${code}`,
            text: `Enter ${code} to sign in. This code expires in 10 minutes.`,
          });
        },

        // Optional custom copy and localization
        copy: {
          code_info: "We'll send a 6-digit verification code to your email",
          button_continue: "Send Verification Code",
        },
      })
    ),
  },

  async success(ctx, value) {
    if (value.provider === "code") {
      const email = value.claims.email;
      const user = await findOrCreateUser(email);
      return ctx.subject("user", { userID: user.id, email });
    }
    throw new Error("Invalid provider");
  },
});
```

---

## 2. Username & Password (`PasswordProvider` & `PasswordUI`)

The `PasswordProvider` manages user registration, secure password hashing, and password resets:

```typescript
import { issuer } from "@openauthjs/openauth";
import { PasswordProvider } from "@openauthjs/openauth/provider/password";
import { PasswordUI } from "@openauthjs/openauth/ui/password";

export const app = issuer({
  // ... subjects & storage
  providers: {
    password: PasswordProvider(
      PasswordUI({
        // Callback invoked when a user resets their password or verifies their email
        async sendCode(email, code) {
          console.log(`[PASSWORD RESET] Code ${code} sent to ${email}`);
          await sendEmail({
            to: email,
            subject: `Password reset verification code: ${code}`,
            text: `Use verification code ${code} to complete password reset.`,
          });
        },

        copy: {
          error_invalid_password: "Invalid password or email address.",
          error_email_taken: "An account already exists with this email.",
        },
      })
    ),
  },

  async success(ctx, value) {
    if (value.provider === "password") {
      const email = value.claims.email;
      const user = await findOrCreateUser(email);
      return ctx.subject("user", { userID: user.id, email });
    }
    throw new Error("Invalid provider");
  },
});
```

---

## 3. Social Logins (GitHub, Google, Discord)

OpenAuth provides native adapters for standard social login OAuth2 flows:

```typescript
import { issuer } from "@openauthjs/openauth";
import { GithubProvider } from "@openauthjs/openauth/provider/github";
import { GoogleOidcProvider } from "@openauthjs/openauth/provider/google";
import { DiscordProvider } from "@openauthjs/openauth/provider/discord";

export const app = issuer({
  // ... subjects & storage
  providers: {
    // 1. GitHub OAuth2
    github: GithubProvider({
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scopes: ["read:user", "user:email"],
    }),

    // 2. Google OIDC (Verifies email without extra profile fetch)
    google: GoogleOidcProvider({
      clientID: process.env.GOOGLE_CLIENT_ID!,
    }),

    // 3. Discord OAuth2
    discord: DiscordProvider({
      clientID: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      scopes: ["identify", "email"],
    }),
  },

  async success(ctx, value) {
    // 1. Google (OIDC returns verified claims directly)
    if (value.provider === "google") {
      const email = value.claims.email;
      const user = await upsertUser("google", value.claims.sub, email);
      return ctx.subject("user", { userID: user.id, email });
    }

    // 2. GitHub (OAuth2 provides value.tokenset.access to query API)
    if (value.provider === "github") {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${value.tokenset.access}`,
          "User-Agent": "OpenAuth",
        },
      });
      const ghUser = await res.json();
      const email = ghUser.email || `${ghUser.login}@users.noreply.github.com`;
      const user = await upsertUser("github", String(ghUser.id), email);
      return ctx.subject("user", { userID: user.id, email: user.email });
    }

    // 3. Discord (OAuth2 provides value.tokenset.access to query Discord user)
    if (value.provider === "discord") {
      const res = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${value.tokenset.access}` },
      });
      const discordUser = await res.json();
      const user = await upsertUser("discord", discordUser.id, discordUser.email || discordUser.username);
      return ctx.subject("user", { userID: user.id, email: user.email });
    }

    throw new Error(`Unsupported provider: ${value.provider}`);
  },
});
```

---

## 4. Multi-Provider Login Screen

When multiple providers are defined in `providers: { code: ..., github: ..., google: ... }`, OpenAuth automatically renders a unified login screen listing all enabled methods with clean styling.

### Security Rules for Providers

1. **Email Verification**: OAuth providers (especially GitHub) may return unverified or missing email addresses if the user marked their email private. Always check `email_verified` or fall back to verified provider user IDs (`value.profile.id`).
2. **Provider Secrets Security**: Always load `clientID` and `clientSecret` from environment variables. Never commit credentials or expose them to client frontends.
