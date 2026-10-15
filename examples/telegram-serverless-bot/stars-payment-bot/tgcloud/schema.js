import { table, integer, text, sql } from "sdk/db";

export const starOrders = table("star_orders", {
  chargeId: text("charge_id").primaryKey(),
  userId: integer("user_id").notNull(),
  amountStars: integer("amount_stars").notNull(),
  productId: text("product_id").notNull(),
  status: text("status").notNull().default("paid"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});
