import { db } from "sdk";
import { eq } from "sdk/db";
import { userSessions } from "../schema.js";

const TTL_SECONDS = 3600;

export async function getSession(userId) {
  const row = await db.select()
    .from(userSessions)
    .where(eq(userSessions.userId, userId))
    .get();

  if (!row) return null;
  const now = Math.floor(Date.now() / 1000);
  const updatedUnix = row.updatedAt instanceof Date ? Math.floor(row.updatedAt.getTime() / 1000) : Number(row.updatedAt);
  if (now - updatedUnix > TTL_SECONDS) {
    await clearSession(userId);
    return null;
  }

  let data = {};
  try {
    data = row.payload ? JSON.parse(row.payload) : {};
  } catch {}

  return { state: row.state, step: row.step, data };
}

export async function setSession(userId, state, step, data = {}) {
  const payloadStr = JSON.stringify(data);
  await db.insert(userSessions)
    .values({
      userId,
      state,
      step,
      payload: payloadStr,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userSessions.userId,
      set: {
        state,
        step,
        payload: payloadStr,
        updatedAt: new Date(),
      },
    })
    .run();
}

export async function clearSession(userId) {
  await db.delete(userSessions)
    .where(eq(userSessions.userId, userId))
    .run();
}
