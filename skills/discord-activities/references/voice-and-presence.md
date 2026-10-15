# Voice Channel Presence and Participants

This reference explains how to read and subscribe to voice channel participants, speaking indicators, and user avatars in Discord Activities.

---

## 1. Reading Connected Participants

To query the active participants currently connected to the current Activity instance:

```typescript
import { DiscordSDK } from "@discord/embedded-app-sdk";

export async function fetchParticipants(discordSdk: DiscordSDK) {
  // Query all users currently loaded in this activity instance
  const { participants } = await discordSdk.commands.getInstanceConnectedParticipants();

  return participants.map((p) => ({
    userId: p.id,
    username: p.username,
    globalName: p.global_name,
    avatar: p.avatar,
    bot: p.bot,
  }));
}
```

---

## 2. Listening to Live Participant Updates

To keep the UI in sync when users join or leave the voice channel Activity, use `Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE`:

```typescript
import { DiscordSDK, Events } from "@discord/embedded-app-sdk";

export async function setupParticipantListener(
  discordSdk: DiscordSDK,
  onUpdate: (participants: any[]) => void
) {
  const handler = ({ participants }: { participants: any[] }) => {
    onUpdate(participants);
  };

  // 1. Subscribe to instance participant changes
  await discordSdk.subscribe(
    Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE,
    handler
  );

  // 2. Return an unhook function that cleans up the listener
  return async () => {
    await discordSdk.unsubscribe(
      Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE,
      handler
    );
  };
}
```

---

## 3. Real-Time Speaking Indicators

Displaying a glowing green ring around active speakers is a signature Discord UI pattern. Subscribe to `Events.SPEAKING_START` and `Events.SPEAKING_STOP` with the channel ID:

```typescript
import { DiscordSDK, Events } from "@discord/embedded-app-sdk";

export async function setupSpeakingIndicators(
  discordSdk: DiscordSDK,
  onSpeakingChange: (userId: string, isSpeaking: boolean) => void
) {
  const channelId = discordSdk.channelId;
  if (!channelId) return () => {};

  const handleStart = ({ user_id }: { user_id: string }) => {
    onSpeakingChange(user_id, true);
  };

  const handleStop = ({ user_id }: { user_id: string }) => {
    onSpeakingChange(user_id, false);
  };

  // 1. Subscribe with channel_id scope
  await discordSdk.subscribe(Events.SPEAKING_START, handleStart, { channel_id: channelId });
  await discordSdk.subscribe(Events.SPEAKING_STOP, handleStop, { channel_id: channelId });

  // 2. Return cleanup function
  return async () => {
    await discordSdk.unsubscribe(Events.SPEAKING_START, handleStart);
    await discordSdk.unsubscribe(Events.SPEAKING_STOP, handleStop);
  };
}
```

---

## 4. Rendering User Avatars

Construct Discord CDN image URLs based on the user's avatar hash:

```typescript
export function getUserAvatarUrl(user: { id: string; avatar?: string | null; discriminator?: string }): string {
  // Custom uploaded avatar (handles animated GIFs and static WEBP)
  if (user.avatar) {
    const isAnimated = user.avatar.startsWith("a_");
    const format = isAnimated ? "gif" : "webp";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${format}?size=128`;
  }

  // Fallback to Discord default avatar
  const defaultIndex = user.discriminator && user.discriminator !== "0"
    ? Number(user.discriminator) % 5
    : (BigInt(user.id) >> 22n) % 6n;

  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}
```

---

## 5. Fetching Current Channel & Guild Details

```typescript
export async function getContextDetails(discordSdk: DiscordSDK) {
  if (!discordSdk.channelId) return null;

  const channel = await discordSdk.commands.getChannel({
    channel_id: discordSdk.channelId,
  });

  return {
    channelId: channel.id,
    channelName: channel.name,
    channelType: channel.type,
    guildId: discordSdk.guildId,
  };
}
```
