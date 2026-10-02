import type { StrategyPerformance, TradeDashboard } from '@workspace/api-client-react';

const makeStrategy = (
  magicNumber: number,
  symbols: string[],
  netResults: number[],
  sharpeRatio: number,
): StrategyPerformance => {
  let cumulativeProfit = 0;
  const equity = netResults.map((netProfit, index) => {
    cumulativeProfit = Number((cumulativeProfit + netProfit).toFixed(2));
    return {
      closeTime: new Date(Date.UTC(2026, 5, 6 + index * 3, 14, 30)).toISOString(),
      netProfit,
      cumulativeProfit,
    };
  });
  const wins = netResults.filter((result) => result > 0);
  const losses = netResults.filter((result) => result < 0);
  const grossProfit = wins.reduce((sum, result) => sum + result, 0);
  const grossLoss = Math.abs(losses.reduce((sum, result) => sum + result, 0));
  let peak = 0;
  let maxDrawdown = 0;
  for (const point of equity) {
    peak = Math.max(peak, point.cumulativeProfit);
    maxDrawdown = Math.max(maxDrawdown, peak - point.cumulativeProfit);
  }

  return {
    magicNumber,
    symbols,
    netProfit: cumulativeProfit,
    profitFactor: grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : null,
    winRate: Number(((wins.length / netResults.length) * 100).toFixed(2)),
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    sharpeRatio,
    payoutRatio: wins.length && losses.length
      ? Number(((grossProfit / wins.length) / (grossLoss / losses.length)).toFixed(2))
      : null,
    tradeCount: netResults.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: netResults.filter((result) => result === 0).length,
    equity,
  };
};

const strategies: StrategyPerformance[] = [
  makeStrategy(26001, ['EURUSD', 'GBPUSD'], [128.4, -34.2, 75.6, -18.5, 96.8, 42.1], 0.82),
  makeStrategy(26017, ['XAUUSD'], [146.2, -81.5, 63.4, -42.7, 121.8, -29.3], 0.47),
  makeStrategy(27104, ['NAS100', 'US30'], [-62, 85, 24, -114, 68, -37], -0.21),
];

const totalWins = strategies.reduce((sum, strategy) => sum + strategy.wins, 0);
const totalLosses = strategies.reduce((sum, strategy) => sum + strategy.losses, 0);
const totalTrades = strategies.reduce((sum, strategy) => sum + strategy.tradeCount, 0);
const totalGrossProfit = strategies.reduce(
  (sum, strategy) => sum + strategy.equity.reduce((tradeSum, trade) => tradeSum + Math.max(0, trade.netProfit), 0),
  0,
);
const totalGrossLoss = strategies.reduce(
  (sum, strategy) => sum + strategy.equity.reduce((tradeSum, trade) => tradeSum + Math.abs(Math.min(0, trade.netProfit)), 0),
  0,
);

let accountProfit = 0;
let accountPeak = 0;
let accountDrawdown = 0;
const closeCount = Math.max(...strategies.map((strategy) => strategy.equity.length));
for (let index = 0; index < closeCount; index += 1) {
  accountProfit += strategies.reduce(
    (sum, strategy) => sum + (strategy.equity[index]?.netProfit ?? 0),
    0,
  );
  accountPeak = Math.max(accountPeak, accountProfit);
  accountDrawdown = Math.max(accountDrawdown, accountPeak - accountProfit);
}

export const previewDemoDashboard: TradeDashboard = {
  strategies,
  pausedMagicNumbers: [24008],
  latestTradeAt: strategies[0].equity.at(-1)?.closeTime ?? null,
  totals: {
    netProfit: Number(strategies.reduce((sum, strategy) => sum + strategy.netProfit, 0).toFixed(2)),
    profitFactor: Number((totalGrossProfit / totalGrossLoss).toFixed(2)),
    winRate: Number(((totalWins / totalTrades) * 100).toFixed(2)),
    maxDrawdown: Number(accountDrawdown.toFixed(2)),
    sharpeRatio: 0.53,
    payoutRatio: Number(((totalGrossProfit / totalWins) / (totalGrossLoss / totalLosses)).toFixed(2)),
    tradeCount: totalTrades,
    wins: totalWins,
    losses: totalLosses,
    magicNumberCount: strategies.length,
  },
};