import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const mt5StrategyTrackingTable = pgTable("mt5_strategy_tracking", {
  magicNumber: integer("magic_number").primaryKey(),
  isMonitored: boolean("is_monitored").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertMt5StrategyTrackingSchema = createInsertSchema(
  mt5StrategyTrackingTable,
).omit({ updatedAt: true });

export type InsertMt5StrategyTracking = z.infer<
  typeof insertMt5StrategyTrackingSchema
>;
export type Mt5StrategyTracking = typeof mt5StrategyTrackingTable.$inferSelect;