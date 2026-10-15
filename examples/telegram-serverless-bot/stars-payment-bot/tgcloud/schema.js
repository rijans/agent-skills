import { table, integer, text } from "sdk/db";

export const star_orders = table("star_orders", {
  charge_id: text("charge_id").primaryKey(),
  user_id: integer("user_id").notNull(),
  amount_stars: integer("amount_stars").notNull(),
  product_id: text("product_id").notNull(),
  status: text("status").notNull(),
  created_at: integer("created_at").notNull()
});
