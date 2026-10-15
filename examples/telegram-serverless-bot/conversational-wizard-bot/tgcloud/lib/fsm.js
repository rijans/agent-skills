import db from "sdk/db";

const TTL_SECONDS = 3600;

export function getSession(userId) {
  const row = db.query(
    "SELECT state, step, payload, updated_at FROM user_sessions WHERE user_id = ?",
    [userId]
  )[0];

  if (!row) return null;
  const now = Math.floor(Date.now() / 1000);
  if (now - row.updated_at > TTL_SECONDS) {
    clearSession(userId);
    return null;
  }

  let data = {};
  try {
    data = row.payload ? JSON.parse(row.payload) : {};
  } catch {}

  return { state: row.state, step: row.step, data };
}

export function setSession(userId, state, step, data = {}) {
  const now = Math.floor(Date.now() / 1000);
  db.query(
    `INSERT INTO user_sessions (user_id, state, step, payload, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       state = excluded.state,
       step = excluded.step,
       payload = excluded.payload,
       updated_at = excluded.updated_at`,
    [userId, state, step, JSON.stringify(data), now]
  );
}

export function clearSession(userId) {
  db.query("DELETE FROM user_sessions WHERE user_id = ?", [userId]);
}
