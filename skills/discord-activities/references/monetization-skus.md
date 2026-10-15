# Monetization and In-App Purchases (SKUs)

This reference explains how to monetize Discord Activities using native Discord In-App Purchases (SKUs) and entitlements.

---

## 1. SKU Types in Discord Activities

Discord supports three SKU types configured in the [Discord Developer Portal](https://discord.com/developers/applications) under **Monetization** $\rightarrow$ **SKUs**:

| SKU Type | Description | Common Use Cases |
|---|---|---|
| **Durable** | Purchased once, permanently tied to user's Discord account. | Level packs, character skins, permanent premium status. |
| **Consumable** | Purchased repeatedly, consumed in-app by developer backend. | In-game coins, gems, revives, extra spins. |
| **Subscription** | Recurring monthly / annual billing managed by Discord. | VIP membership, premium servers, cloud save slots. |

---

## 2. Initiating Purchases (`startPurchase`)

To open Discord's native checkout modal inside the Activity:

```typescript
import { DiscordSDK } from "@discord/embedded-app-sdk";

export async function purchaseItem(discordSdk: DiscordSDK, skuId: string) {
  try {
    // Triggers Discord's native checkout UI overlay
    const result = await discordSdk.commands.startPurchase({
      sku_id: skuId,
    });

    console.log("Purchase completed successfully:", result);
    return true;
  } catch (err: any) {
    if (err.code === 4004) {
      console.log("User closed or cancelled checkout modal.");
      return false;
    }
    console.error("Purchase error:", err);
    throw err;
  }
}
```

---

## 3. Querying Active Entitlements on Client

Check whether the current user owns an entitlement:

```typescript
export async function checkUserEntitlements(discordSdk: DiscordSDK, skuId: string): Promise<boolean> {
  const { entitlements } = await discordSdk.commands.getEntitlements();

  // Find non-deleted, active entitlement matching the SKU
  const hasAccess = entitlements.some(
    (e) => e.sku_id === skuId && !e.deleted && (e.ends_at == null || new Date(e.ends_at) > new Date())
  );

  return hasAccess;
}
```

### Listening for Real-Time Entitlement Grants

When a user completes a checkout modal, Discord fires an `ENTITLEMENT_CREATE` event directly to the Activity:

```typescript
import { DiscordSDK, Events } from "@discord/embedded-app-sdk";

export async function setupEntitlementListener(
  discordSdk: DiscordSDK,
  onGrant: (entitlement: any) => void
) {
  const handler = ({ entitlement }: { entitlement: any }) => {
    console.log("Entitlement received in real time:", entitlement);
    onGrant(entitlement);
  };

  // Subscribe to real-time purchase updates
  await discordSdk.subscribe(Events.ENTITLEMENT_CREATE, handler);

  // Return cleanup function to unsubscribe on unmount
  return async () => {
    await discordSdk.unsubscribe(Events.ENTITLEMENT_CREATE, handler);
  };
}
```

---

## 4. Server-Side Verification & Consuming Consumables

> [!IMPORTANT]
> Never unlock sensitive digital content purely based on client-side state. Always verify entitlements on your backend using your `BOT_TOKEN` via the Discord REST API:

```typescript
// server/src/entitlements.ts

export async function verifyUserEntitlement(
  applicationId: string,
  botToken: string,
  userId: string,
  skuId: string
): Promise<boolean> {
  const url = `https://discord.com/api/v10/applications/${applicationId}/entitlements?user_id=${userId}&sku_ids=${skuId}&exclude_ended=true`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to query entitlements: ${res.statusText}`);
  }

  const entitlements = await res.json();
  return Array.isArray(entitlements) && entitlements.length > 0;
}

export async function consumeEntitlement(
  applicationId: string,
  botToken: string,
  entitlementId: string
) {
  // Mark consumable as fulfilled so the user can purchase it again
  const url = `https://discord.com/api/v10/applications/${applicationId}/entitlements/${entitlementId}/consume`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
    },
  });

  return res.ok;
}
```
