import { table, integer, text, sql } from "sdk/db";

export const userSessions = table("user_sessions", {
  userId: integer("user_id").primaryKey(),
  state: text("state").notNull(),
  step: text("step").notNull(),
  payload: text("payload"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const members = table("members", {
  userId: integer("user_id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});
