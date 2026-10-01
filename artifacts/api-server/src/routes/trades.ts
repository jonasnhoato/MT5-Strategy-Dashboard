import { asc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  ClearTradesResponse,
  GetTradesDashboardResponse,
  IngestTradesBody,
  IngestTradesResponse,
  PauseMagicNumberResponse,
  ResumeMagicNumberResponse,
} from "@workspace/api-zod";
import {
  db,
  mt5StrategyTrackingTable,
  mt5TradesTable,
} from "@workspace/db";
import { calculateTradeMetrics } from "../lib/trade-metrics";

const router: IRouter = Router();
const INSERT_BATCH_SIZE = 500;
const POSTGRES_INTEGER_MIN = -2_147_483_648;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

function parseMagicNumber(value: string): number | null {
  const magicNumber = Number(value);
  return Number.isInteger(magicNumber)
    && magicNumber >= POSTGRES_INTEGER_MIN
    && magicNumber <= POSTGRES_INTEGER_MAX
    ? magicNumber
    : null;
}

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
  const magicNumbers = [...new Set(rows.map((trade) => trade.magicNumber))]
    .sort((a, b) => a - b);
  let ignored = 0;

  await db.transaction(async (tx) => {
    await tx
      .insert(mt5StrategyTrackingTable)
      .values(magicNumbers.map((magicNumber) => ({ magicNumber })))
      .onConflictDoNothing();

    const tracking = await tx
      .select({
        magicNumber: mt5StrategyTrackingTable.magicNumber,
        isMonitored: mt5StrategyTrackingTable.isMonitored,
      })
      .from(mt5StrategyTrackingTable)
      .where(inArray(mt5StrategyTrackingTable.magicNumber, magicNumbers))
      .orderBy(asc(mt5StrategyTrackingTable.magicNumber))
      .for("update");
    const pausedMagicNumbers = new Set(
      tracking
        .filter((setting) => !setting.isMonitored)
        .map((setting) => setting.magicNumber),
    );
    const trackedRows = rows.filter(
      (trade) => !pausedMagicNumbers.has(trade.magicNumber),
    );
    ignored = rows.length - trackedRows.length;

    for (
      let offset = 0;
      offset < trackedRows.length;
      offset += INSERT_BATCH_SIZE
    ) {
      const batch = trackedRows.slice(offset, offset + INSERT_BATCH_SIZE);
      const result = await tx
        .insert(mt5TradesTable)
        .values(batch)
        .onConflictDoNothing({
          target: [mt5TradesTable.accountId, mt5TradesTable.ticket],
        })
        .returning({ id: mt5TradesTable.id });
      inserted += result.length;
    }
  });

  res.json(IngestTradesResponse.parse({
    received,
    inserted,
    duplicates: received - inserted - ignored,
    ignored,
  }));
});

router.delete("/trades", async (_req, res): Promise<void> => {
  await db.delete(mt5TradesTable);
  res.json(ClearTradesResponse.parse({ cleared: true }));
});

router.delete("/trades/magic/:magicNumber", async (req, res): Promise<void> => {
  const magicNumber = parseMagicNumber(req.params.magicNumber);
  if (magicNumber == null) {
    res.status(400).json({ error: "magicNumber must be a valid 32-bit integer" });
    return;
  }

  const deletedTrades = await db.transaction(async (tx) => {
    await tx
      .insert(mt5StrategyTrackingTable)
      .values({ magicNumber, isMonitored: false })
      .onConflictDoUpdate({
        target: mt5StrategyTrackingTable.magicNumber,
        set: { isMonitored: false, updatedAt: new Date() },
      });
    const deleted = await tx
      .delete(mt5TradesTable)
      .where(eq(mt5TradesTable.magicNumber, magicNumber))
      .returning({ id: mt5TradesTable.id });
    return deleted.length;
  });

  res.json(PauseMagicNumberResponse.parse({
    magicNumber,
    monitoring: false,
    deletedTrades,
  }));
});

router.put("/trades/magic/:magicNumber", async (req, res): Promise<void> => {
  const magicNumber = parseMagicNumber(req.params.magicNumber);
  if (magicNumber == null) {
    res.status(400).json({ error: "magicNumber must be a valid 32-bit integer" });
    return;
  }

  await db
    .insert(mt5StrategyTrackingTable)
    .values({ magicNumber, isMonitored: true })
    .onConflictDoUpdate({
      target: mt5StrategyTrackingTable.magicNumber,
      set: { isMonitored: true, updatedAt: new Date() },
    });

  res.json(ResumeMagicNumberResponse.parse({
    magicNumber,
    monitoring: true,
    deletedTrades: 0,
  }));
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

  const pausedMagicNumbers = await db
    .select({ magicNumber: mt5StrategyTrackingTable.magicNumber })
    .from(mt5StrategyTrackingTable)
    .where(eq(mt5StrategyTrackingTable.isMonitored, false))
    .orderBy(asc(mt5StrategyTrackingTable.magicNumber));

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
      pausedMagicNumbers: pausedMagicNumbers.map((entry) => entry.magicNumber),
      latestTradeAt: trades.length > 0 ? trades[trades.length - 1].closeTime : null,
    }),
  );
});

export default router;