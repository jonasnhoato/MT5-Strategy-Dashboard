import { asc } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  ClearTradesResponse,
  GetTradesDashboardResponse,
  IngestTradesBody,
  IngestTradesResponse,
} from "@workspace/api-zod";
import { db, mt5TradesTable } from "@workspace/db";
import { calculateTradeMetrics } from "../lib/trade-metrics";

const router: IRouter = Router();
const INSERT_BATCH_SIZE = 500;

router.post("/trades", async (req, res): Promise<void> => {
  const parsed = IngestTradesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const accountId = parsed.data.account_id ?? "default";
  const received = parsed.data.trades.length;
  let inserted = 0;

  const rows = parsed.data.trades.map((trade) => ({
    accountId,
    ticket: trade.ticket == null ? null : String(trade.ticket),
    magicNumber: trade.magic_number,
    symbol: trade.symbol ?? null,
    tradeType: trade.type ?? null,
    volume: trade.volume ?? null,
    openTime: trade.open_time ?? null,
    closeTime: trade.close_time,
    grossProfit: trade.profit,
    commission: trade.commission,
    swap: trade.swap,
    netProfit: trade.profit + trade.commission + trade.swap,
    comment: trade.comment ?? null,
  }));

  for (let offset = 0; offset < rows.length; offset += INSERT_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + INSERT_BATCH_SIZE);
    const result = await db
      .insert(mt5TradesTable)
      .values(batch)
      .onConflictDoNothing({
        target: [mt5TradesTable.accountId, mt5TradesTable.ticket],
      })
      .returning({ id: mt5TradesTable.id });
    inserted += result.length;
  }

  res.json(IngestTradesResponse.parse({
    received,
    inserted,
    duplicates: received - inserted,
  }));
});

router.delete("/trades", async (_req, res): Promise<void> => {
  await db.delete(mt5TradesTable);
  res.json(ClearTradesResponse.parse({ cleared: true }));
});

router.get("/trades/dashboard", async (_req, res): Promise<void> => {
  const trades = await db
    .select({
      id: mt5TradesTable.id,
      magicNumber: mt5TradesTable.magicNumber,
      symbol: mt5TradesTable.symbol,
      closeTime: mt5TradesTable.closeTime,
      netProfit: mt5TradesTable.netProfit,
    })
    .from(mt5TradesTable)
    .orderBy(asc(mt5TradesTable.closeTime), asc(mt5TradesTable.id));

  const byMagicNumber = new Map<number, typeof trades>();
  for (const trade of trades) {
    const group = byMagicNumber.get(trade.magicNumber);
    if (group) {
      group.push(trade);
    } else {
      byMagicNumber.set(trade.magicNumber, [trade]);
    }
  }

  const strategies = [...byMagicNumber.entries()]
    .map(([magicNumber, strategyTrades]) => {
      const symbols = [...new Set(
        strategyTrades
          .map((trade) => trade.symbol?.trim().toUpperCase())
          .filter((symbol): symbol is string => Boolean(symbol)),
      )].sort();

      return {
        magicNumber,
        symbols,
        ...calculateTradeMetrics(strategyTrades),
      };
    })
    .sort((a, b) => b.netProfit - a.netProfit || a.magicNumber - b.magicNumber);
  const totals = calculateTradeMetrics(trades);

  res.json(
    GetTradesDashboardResponse.parse({
      totals: {
        netProfit: totals.netProfit,
        profitFactor: totals.profitFactor,
        winRate: totals.winRate,
        maxDrawdown: totals.maxDrawdown,
        sharpeRatio: totals.sharpeRatio,
        payoutRatio: totals.payoutRatio,
        tradeCount: totals.tradeCount,
        wins: totals.wins,
        losses: totals.losses,
        magicNumberCount: strategies.length,
      },
      strategies,
      latestTradeAt: trades.length > 0 ? trades[trades.length - 1].closeTime : null,
    }),
  );
});

export default router;