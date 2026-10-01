import { createInsertSchema } from "drizzle-zod";
import {
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const mt5TradesTable = pgTable(
  "mt5_trades",
  {
    id: serial("id").primaryKey(),
    accountId: text("account_id").notNull().default("default"),
    ticket: text("ticket"),
    magicNumber: integer("magic_number").notNull(),
    symbol: text("symbol"),
    tradeType: text("trade_type"),
    volume: doublePrecision("volume"),
    openTime: timestamp("open_time", { withTimezone: true }),
    closeTime: timestamp("close_time", { withTimezone: true }).notNull(),
    grossProfit: doublePrecision("gross_profit").notNull(),
    commission: doublePrecision("commission").notNull().default(0),
    swap: doublePrecision("swap").notNull().default(0),
    netProfit: doublePrecision("net_profit").notNull(),
    comment: text("comment"),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("mt5_trades_account_ticket_unique").on(
      table.accountId,
      table.ticket,
    ),
    index("mt5_trades_magic_close_time_idx").on(
      table.magicNumber,
      table.closeTime,
    ),
    index("mt5_trades_close_time_idx").on(table.closeTime),
  ],
);

export const insertMt5TradeSchema = createInsertSchema(mt5TradesTable).omit({
  id: true,
  ingestedAt: true,
});

export type InsertMt5Trade = z.infer<typeof insertMt5TradeSchema>;
export type Mt5Trade = typeof mt5TradesTable.$inferSelect;