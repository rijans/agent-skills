import { table, integer, text } from "sdk/db";

export const user_sessions = table("user_sessions", {
  user_id: integer("user_id").primaryKey(),
  state: text("state").notNull(),
  step: text("step").notNull(),
  payload: text("payload"),
  updated_at: integer("updated_at").notNull()
});

export const members = table("members", {
  user_id: integer("user_id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  created_at: integer("created_at").notNull()
});
