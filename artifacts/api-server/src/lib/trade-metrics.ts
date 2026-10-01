import type { Mt5Trade } from "@workspace/db";

type EquitySource = Pick<Mt5Trade, "closeTime" | "netProfit">;

export type TradeMetrics = {
  netProfit: number;
  profitFactor: number | null;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number | null;
  payoutRatio: number | null;
  tradeCount: number;
  wins: number;
  losses: number;
  breakeven: number;
  equity: Array<{
    closeTime: Date;
    netProfit: number;
    cumulativeProfit: number;
  }>;
};

export function calculateTradeMetrics(
  trades: EquitySource[],
): TradeMetrics {
  let netProfit = 0;
  let grossWins = 0;
  let grossLosses = 0;
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let cumulativeProfit = 0;
  let equityPeak = 0;
  let maxDrawdown = 0;
  const equity: TradeMetrics["equity"] = [];

  for (const trade of trades) {
    const value = trade.netProfit;
    netProfit += value;

    if (value > 0) {
      wins += 1;
      grossWins += value;
    } else if (value < 0) {
      losses += 1;
      grossLosses += Math.abs(value);
    } else {
      breakeven += 1;
    }

    cumulativeProfit += value;
    equityPeak = Math.max(equityPeak, cumulativeProfit);
    maxDrawdown = Math.max(maxDrawdown, equityPeak - cumulativeProfit);
    equity.push({
      closeTime: trade.closeTime,
      netProfit: value,
      cumulativeProfit,
    });
  }

  const tradeCount = trades.length;
  const mean = tradeCount === 0 ? 0 : netProfit / tradeCount;
  const squaredDeviation = trades.reduce(
    (sum, trade) => sum + (trade.netProfit - mean) ** 2,
    0,
  );
  const standardDeviation =
    tradeCount > 1 ? Math.sqrt(squaredDeviation / (tradeCount - 1)) : 0;

  return {
    netProfit,
    profitFactor: grossLosses > 0 ? grossWins / grossLosses : null,
    winRate: tradeCount > 0 ? (wins / tradeCount) * 100 : 0,
    maxDrawdown,
    sharpeRatio:
      tradeCount > 1 && standardDeviation > 0
        ? mean / standardDeviation
        : null,
    payoutRatio:
      wins > 0 && losses > 0
        ? grossWins / wins / (grossLosses / losses)
        : null,
    tradeCount,
    wins,
    losses,
    breakeven,
    equity,
  };
}