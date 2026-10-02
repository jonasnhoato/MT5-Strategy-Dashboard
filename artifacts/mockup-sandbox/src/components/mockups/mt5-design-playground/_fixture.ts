export type EquityPoint = {
  closeTime: string;
  netProfit: number;
  cumulativeProfit: number;
};

export type StrategyPerformance = {
  magicNumber: number;
  symbols: string[];
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
  equity: EquityPoint[];
};

export type DashboardFixture = {
  totals: Omit<StrategyPerformance, 'magicNumber' | 'symbols' | 'breakeven' | 'equity'> & {
    magicNumberCount: number;
  };
  strategies: StrategyPerformance[];
  pausedMagicNumbers: number[];
  latestTradeAt: string;
};

const equity = (changes: number[]): EquityPoint[] => {
  let cumulativeProfit = 0;
  return changes.map((netProfit, index) => {
    cumulativeProfit = Number((cumulativeProfit + netProfit).toFixed(2));
    return {
      closeTime: new Date(Date.UTC(2026, 2, index * 3 + 2, 14, 30)).toISOString(),
      netProfit,
      cumulativeProfit,
    };
  });
};

const strategy = (
  magicNumber: number,
  symbols: string[],
  changes: number[],
  metrics: Omit<StrategyPerformance, 'magicNumber' | 'symbols' | 'equity' | 'netProfit'>,
): StrategyPerformance => ({
  magicNumber,
  symbols,
  ...metrics,
  netProfit: Number(changes.reduce((sum, value) => sum + value, 0).toFixed(2)),
  equity: equity(changes),
});

const strategies: StrategyPerformance[] = [
  strategy(26001, ['EURUSD', 'GBPUSD'], [82.4, -24.8, 116.2, 38.6, -41.5, 94.2, 57.8, -18.4, 133.1, 61.3, -29.7, 103.5], {
    profitFactor: 6.01, winRate: 66.67, maxDrawdown: 41.5, sharpeRatio: 0.77, payoutRatio: 3.00,
    tradeCount: 12, wins: 8, losses: 4, breakeven: 0,
  }),
  strategy(26017, ['XAUUSD'], [145.6, -88.2, 72.4, -51.3, 184.9, -34.7, 96.1, -67.8, 128.5, -42.6, 75.3, -31.4], {
    profitFactor: 2.22, winRate: 50, maxDrawdown: 88.2, sharpeRatio: 0.34, payoutRatio: 2.22,
    tradeCount: 12, wins: 6, losses: 6, breakeven: 0,
  }),
  strategy(27104, ['NAS100', 'US30'], [-54.8, 32.1, -91.4, 48.7, -36.2, 21.5, -72.9, 39.4, -44.1, 18.6, -65.3, 27.8], {
    profitFactor: 0.52, winRate: 50, maxDrawdown: 204.4, sharpeRatio: -0.29, payoutRatio: 0.52,
    tradeCount: 12, wins: 6, losses: 6, breakeven: 0,
  }),
  strategy(28420, ['USDJPY', 'EURJPY'], [64.3, -22.7, 48.9, 31.2, -18.5, 77.6, -35.4, 56.1, 42.8, -27.3, 69.5, 34.7], {
    profitFactor: 4.09, winRate: 66.67, maxDrawdown: 35.4, sharpeRatio: 0.65, payoutRatio: 2.05,
    tradeCount: 12, wins: 8, losses: 4, breakeven: 0,
  }),
  strategy(29511, ['AUDUSD'], [-39.5, 18.2, -62.8, -28.4, 35.1, -47.6, 22.9, -53.3, 16.4, -31.7, 27.5, -24.6], {
    profitFactor: 0.42, winRate: 41.67, maxDrawdown: 170.7, sharpeRatio: -0.39, payoutRatio: 0.58,
    tradeCount: 12, wins: 5, losses: 7, breakeven: 0,
  }),
];

const wins = strategies.reduce((sum, item) => sum + item.wins, 0);
const losses = strategies.reduce((sum, item) => sum + item.losses, 0);
const tradeCount = strategies.reduce((sum, item) => sum + item.tradeCount, 0);
const netProfit = Number(strategies.reduce((sum, item) => sum + item.netProfit, 0).toFixed(2));

// Local-only sample data. Values are intentionally illustrative and make no API calls.
export const fixture: DashboardFixture = {
  strategies,
  pausedMagicNumbers: [24008, 30219],
  latestTradeAt: '2026-04-04T14:30:00.000Z',
  totals: {
    netProfit,
    profitFactor: 1.79,
    winRate: Number(((wins / tradeCount) * 100).toFixed(2)),
    maxDrawdown: 171.6,
    sharpeRatio: 0.24,
    payoutRatio: 1.46,
    tradeCount,
    wins,
    losses,
    magicNumberCount: strategies.length,
  },
};

export const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);

export const percent = (value: number) => `${value.toFixed(1)}%`;