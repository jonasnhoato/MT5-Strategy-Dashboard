import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  getGetTradesDashboardQueryKey, useClearTrades, useGetTradesDashboard,
  usePauseMagicNumber, useResumeMagicNumber,
} from '@workspace/api-client-react';
import type { StrategyPerformance } from '@workspace/api-client-react';
import { CSVLink } from 'react-csv';
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from 'recharts';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Check,
  ChevronDown, CircleHelp, Clock3, Download, ExternalLink, Moon, Printer,
  RefreshCw, Sun, Trash2, TrendingUp, WalletCards, X,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const INTERVALS = [
  { label: '5 minutes', ms: 5 * 60 * 1000 },
  { label: '15 minutes', ms: 15 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
];
const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);
const compactMoney = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
}).format(value);
const percent = (value: number) => `${value.toFixed(1)}%`;
const metric = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};
const timestamp = (value?: number) => value
  ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  : 'Waiting for first sync';

const equityCsvHeaders = [
  { label: 'close_time', key: 'closeTime' },
  { label: 'trade_net_profit', key: 'netProfit' },
  { label: 'cumulative_net_profit', key: 'cumulativeProfit' },
];

function pfLabel(
  value: number | null,
  strategy?: Pick<StrategyPerformance, 'losses' | 'netProfit'>,
) {
  if (value != null && Number.isFinite(value)) return value.toFixed(2);
  if (strategy && strategy.losses === 0 && strategy.netProfit > 0) return '∞';
  return '—';
}

function MetricTile({ label, value, detail, tone = 'neutral', icon }: {
  label: string; value: string; detail?: string; tone?: 'positive' | 'negative' | 'neutral'; icon: ReactNode;
}) {
  return <div className="panel min-w-0 rounded-xl p-4 md:p-[18px]">
    <div className="flex items-center justify-between gap-2">
      <span className="metric-label">{label}</span>
      <span className="text-muted-foreground">{icon}</span>
    </div>
    <div className={`mono mt-3 truncate text-[23px] font-medium tracking-[-.045em] md:text-[26px] ${tone === 'positive' ? 'text-emerald-300' : tone === 'negative' ? 'text-rose-300' : 'text-foreground'}`} data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
      {value}
    </div>
    {detail && <div className="mt-1.5 truncate text-[11px] text-muted-foreground">{detail}</div>}
  </div>;
}

function EquityChart({ strategy, light }: { strategy: StrategyPerformance; light: boolean }) {
  const points = useMemo(() => [...strategy.equity].sort(
    (a, b) => new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime(),
  ), [strategy.equity]);
  const stroke = strategy.netProfit >= 0 ? '#63d6a9' : '#f08a81';
  const grid = light ? 'rgba(52,69,82,.13)' : 'rgba(175,192,205,.11)';
  const ticks = light ? '#657482' : '#8897a4';
  const id = `fill-${strategy.magicNumber}`.replaceAll('-', 'n');
  return <div className="relative h-[228px] w-full sm:h-[260px]" role="img" aria-label={`Magic number ${strategy.magicNumber} cumulative net profit equity chart`}>
    {!points.length ? (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/80 text-sm text-muted-foreground">No closed-trade equity points for this strategy.</div>
    ) : (
      <ResponsiveContainer width="100%" height="100%" debounce={0}>
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.27} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.015} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={grid} strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="closeTime" tickFormatter={dateLabel} tick={{ fill: ticks, fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={34} />
          <YAxis tickFormatter={compactMoney} tick={{ fill: ticks, fontSize: 10 }} axisLine={false} tickLine={false} width={64} />
          <ReferenceLine y={0} stroke={grid} strokeDasharray="4 4" />
          <Tooltip
            cursor={{ stroke: stroke, strokeDasharray: '3 4', strokeOpacity: .5 }}
            contentStyle={{ background: light ? '#f7faf9' : '#151d24', border: `1px solid ${light ? '#d9e2df' : '#2b3943'}`, borderRadius: 9, color: light ? '#15212a' : '#e3e9eb', fontSize: 12 }}
            labelFormatter={(label) => new Date(String(label)).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            formatter={(value, name) => [money(Number(value)), name === 'cumulativeProfit' ? 'Cumulative net profit' : 'Trade net profit']}
          />
          <Area type="monotone" dataKey="cumulativeProfit" name="Cumulative net profit" stroke={stroke} strokeWidth={2} fill={`url(#${id})`} activeDot={{ r: 4, fill: stroke, stroke: light ? '#f7faf9' : '#151d24', strokeWidth: 2 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    )}
  </div>;
}

function StrategyPanel({ strategy, light, onPause, pausePending }: {
  strategy: StrategyPerformance;
  light: boolean;
  onPause: (strategy: StrategyPerformance) => void;
  pausePending: boolean;
}) {
  const positive = strategy.netProfit >= 0;
  const symbols = strategy.symbols ?? [];
  const stat = [
    ['Profit factor', pfLabel(strategy.profitFactor, strategy)],
    ['Win rate', percent(strategy.winRate)],
    ['Max drawdown', money(strategy.maxDrawdown)],
    ['Avg net / trade', money(strategy.tradeCount > 0 ? strategy.netProfit / strategy.tradeCount : 0)],
    ['Sharpe ratio', metric(strategy.sharpeRatio)],
    ['Payout ratio', strategy.payoutRatio == null ? '—' : `${metric(strategy.payoutRatio)}×`],
    ['Wins / losses', `${strategy.wins} / ${strategy.losses}`],
  ];
  return <section className="panel overflow-hidden rounded-2xl" data-testid={`strategy-${strategy.magicNumber}`}>
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 px-5 py-4 md:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><Activity size={17}/></div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display font-semibold tracking-[-.03em] text-[17px]">Magic number <span className="mono text-primary">{strategy.magicNumber}</span></h2>
            {symbols.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5" aria-label={`Assets traded by magic number ${strategy.magicNumber}`}>
                <span className="mr-0.5 text-[9px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Assets</span>
                {symbols.map((symbol) => (
                  <span key={symbol} title={`Traded asset: ${symbol}`} className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide text-primary">
                    {symbol}
                  </span>
                ))}
              </div>
            ) : (
              <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">No ticker data</span>
            )}
            <span className="rounded-full border border-border bg-muted/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{strategy.tradeCount} trades</span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Expert Advisor performance · {strategy.breakeven} breakeven</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="metric-label">Net profit</div>
          <div className={`mono mt-0.5 text-[19px] font-medium ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>{money(strategy.netProfit)}</div>
        </div>
        <button
          type="button"
          onClick={() => onPause(strategy)}
          disabled={pausePending}
          className="print-hidden inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/[.07] px-2.5 text-xs font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/[.12] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Stop monitoring and delete history for magic number ${strategy.magicNumber}`}
          title="Stop monitoring and delete this strategy's history"
          data-testid={`button-delete-strategy-${strategy.magicNumber}`}
        ><Trash2 size={13}/><span>Delete</span></button>
        {strategy.equity.length > 0 && <CSVLink
          data={strategy.equity}
          headers={equityCsvHeaders}
          filename={`magic-${strategy.magicNumber}-net-profit-equity.csv`}
          className="print-hidden inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          aria-label={`Export magic number ${strategy.magicNumber} equity as CSV`}
          data-testid={`export-csv-${strategy.magicNumber}`}
        ><Download size={14}/><span className="hidden sm:inline">CSV</span></CSVLink>}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-px border-b border-border/70 bg-border/60 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7">
      {stat.map(([label, value]) => <div key={label} className="bg-card/95 px-4 py-3">
        <div className="metric-label !text-[9px]">{label}</div>
        <div className="mono mt-1.5 text-[13px] font-medium text-foreground">{value}</div>
      </div>)}
    </div>
    <div className="px-4 pb-4 pt-3 md:px-5 md:pb-5">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-[12px] font-medium">Cumulative net profit</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Closed trades over time · account currency in USD</div>
        </div>
        <span className="mono text-[10px] text-muted-foreground">{strategy.equity.length} points</span>
      </div>
      <EquityChart strategy={strategy} light={light}/>
    </div>
  </section>;
}

function Home() {
  const [light, setLight] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [intervalMs, setIntervalMs] = useState(INTERVALS[0].ms);
  const [menuOpen, setMenuOpen] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearTradeError, setClearTradeError] = useState<string | null>(null);
  const [strategyToPause, setStrategyToPause] = useState<StrategyPerformance | null>(null);
  const [strategyActionError, setStrategyActionError] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [trackingNotice, setTrackingNotice] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const query = useGetTradesDashboard({
    query: {
      queryKey: getGetTradesDashboardQueryKey(),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchInterval: autoRefresh ? intervalMs : false,
    },
  });
  const clearTradesMutation = useClearTrades({
    mutation: {
      onSuccess: async () => {
        setClearDialogOpen(false);
        setClearTradeError(null);
        await queryClient.invalidateQueries({
          queryKey: getGetTradesDashboardQueryKey(),
        });
      },
      onError: () => {
        setClearTradeError('Trade history could not be cleared. Please try again.');
      },
    },
  });
  const pauseMagicNumberMutation = usePauseMagicNumber({
    mutation: {
      onSuccess: async (result) => {
        setStrategyToPause(null);
        setStrategyActionError(null);
        setTrackingNotice(
          `Magic number ${result.magicNumber} paused. Removed ${result.deletedTrades} stored trades. Re-enable it below to accept future uploads.`,
        );
        await queryClient.invalidateQueries({
          queryKey: getGetTradesDashboardQueryKey(),
        });
      },
      onError: () => {
        setStrategyActionError('This magic number could not be paused. Please try again.');
      },
    },
  });
  const resumeMagicNumberMutation = useResumeMagicNumber({
    mutation: {
      onSuccess: async (result) => {
        setResumeError(null);
        setTrackingNotice(
          `Magic number ${result.magicNumber} is active again. New trades will appear after the next MT5 upload; deleted history is not restored.`,
        );
        await queryClient.invalidateQueries({
          queryKey: getGetTradesDashboardQueryKey(),
        });
      },
      onError: () => {
        setResumeError('Monitoring could not be resumed. Please try again.');
      },
    },
  });
  const data = query.data;
  const pausedMagicNumbers = data?.pausedMagicNumbers ?? [];
  const loading = query.isLoading || query.isFetching;
  const hasData = !!data && (data.totals.tradeCount > 0 || data.strategies.length > 0);
  const webhookUrl = `${window.location.origin}/api/trades`;
  const updatedAt = timestamp(query.dataUpdatedAt);
  useEffect(() => {
    document.documentElement.classList.toggle('light', light);
    document.documentElement.classList.toggle('dark', !light);
  }, [light]);
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, []);
  const orderedStrategies = useMemo(() => data ? [...data.strategies].sort((a, b) => b.netProfit - a.netProfit) : [], [data]);

  return <main className="dashboard-shell min-h-[100dvh] bg-background">
    <div className="mx-auto max-w-[1480px] px-4 pb-12 pt-4 sm:px-6 sm:pt-6 lg:px-9">
      <header className="fade-up mb-7 flex flex-wrap items-center justify-between gap-5 border-b border-border/70 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Activity size={21} strokeWidth={1.8}/>
            <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-primary">Terminal / analytics</p>
              <span className="rounded border border-border/80 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-muted-foreground">MT5</span>
            </div>
            <h1 className="mt-0.5 font-display text-[22px] font-bold tracking-[-.055em] md:text-[26px]">Strategy performance</h1>
          </div>
        </div>
        <div className="print-hidden flex flex-wrap items-center gap-2">
          <div ref={menuRef} className="relative">
            <div className="flex h-9 overflow-hidden rounded-lg border border-border bg-card">
              <button type="button" onClick={() => query.refetch()} disabled={loading} className="flex items-center gap-2 px-3 text-[12px] font-medium transition hover:bg-muted disabled:opacity-50" data-testid="button-refresh">
                <RefreshCw size={14} className={query.isFetching ? 'animate-spin text-primary' : ''}/> Refresh
              </button>
              <div className="my-2 w-px bg-border"/>
              <button type="button" onClick={() => setMenuOpen((open) => !open)} className="flex items-center gap-1.5 px-2.5 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Dashboard settings" aria-expanded={menuOpen} data-testid="button-dashboard-settings">
                {autoRefresh ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> : null}
                <ChevronDown size={14}/>
              </button>
            </div>
            {menuOpen && <div className="absolute right-0 top-11 z-20 w-60 rounded-xl border border-border bg-popover p-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div><div className="text-xs font-semibold">Auto-refresh</div><div className="mt-0.5 text-[10px] text-muted-foreground">Off by default</div></div>
                <button type="button" role="switch" aria-checked={autoRefresh} onClick={() => setAutoRefresh((value) => !value)} className={`relative h-5 w-9 rounded-full transition ${autoRefresh ? 'bg-primary' : 'bg-muted'}`} data-testid="toggle-auto-refresh">
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${autoRefresh ? 'translate-x-[18px]' : 'translate-x-0.5'}`}/>
                </button>
              </div>
              <div className={`space-y-0.5 pt-2 ${!autoRefresh ? 'pointer-events-none opacity-45' : ''}`}>
                <div className="px-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Interval</div>
                {INTERVALS.map((option) => <button key={option.ms} type="button" onClick={() => { setIntervalMs(option.ms); setMenuOpen(false); }} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted" data-testid={`interval-${option.ms}`}>
                  {option.label}{intervalMs === option.ms && <Check size={13} className="text-primary"/>}
                </button>)}
              </div>
              <div className="mt-2 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground">Automatic checks run no more often than every 5 minutes.</div>
            </div>}
          </div>
          <button type="button" disabled={pauseMagicNumberMutation.isPending} onClick={() => {
            setClearTradeError(null);
            setMenuOpen(false);
            setClearDialogOpen(true);
          }} className="flex h-9 items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/[.07] px-3 text-[12px] font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/[.12] disabled:cursor-not-allowed disabled:opacity-50" aria-label="Clear all trades" data-testid="button-clear-all-trades">
            <Trash2 size={14}/><span>Clear all trades</span>
          </button>
          <button type="button" onClick={() => window.print()} className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[12px] text-muted-foreground transition hover:text-foreground" aria-label="Export dashboard as PDF" data-testid="button-export-pdf"><Printer size={14}/><span className="hidden sm:inline">PDF</span></button>
          <button type="button" onClick={() => setLight((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:text-foreground" aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'} data-testid="button-toggle-theme">{light ? <Moon size={15}/> : <Sun size={15}/>}</button>
        </div>
      </header>
      {trackingNotice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/[.07] px-3 py-2 text-xs text-foreground" data-testid="status-strategy-tracking">
        <span>{trackingNotice}</span>
        <button type="button" onClick={() => setTrackingNotice(null)} className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Dismiss strategy status"><X size={14}/></button>
      </div>}
      <AlertDialog
        open={clearDialogOpen}
        onOpenChange={(open) => {
          if (!clearTradesMutation.isPending) {
            setClearDialogOpen(open);
            if (!open) setClearTradeError(null);
          }
        }}
      >
        <AlertDialogContent data-testid="dialog-clear-trades">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all trade history?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes trades from every MT5 account and removes all strategy metrics and equity history. Other database tables are not affected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {clearTradeError && <p role="alert" className="text-sm text-destructive" data-testid="status-clear-trades-error">{clearTradeError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearTradesMutation.isPending} data-testid="button-cancel-clear-trades">Keep trades</AlertDialogCancel>
            <AlertDialogAction
              disabled={clearTradesMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                setClearTradeError(null);
                clearTradesMutation.mutate(undefined);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-clear-trades"
            >
              {clearTradesMutation.isPending ? 'Clearing…' : 'Clear all trade history'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={strategyToPause !== null}
        onOpenChange={(open) => {
          if (!pauseMagicNumberMutation.isPending && !open) {
            setStrategyToPause(null);
            setStrategyActionError(null);
          }
        }}
      >
        <AlertDialogContent data-testid="dialog-pause-strategy">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Pause magic number {strategyToPause?.magicNumber} and delete its history?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This deletes all stored trades for magic number {strategyToPause?.magicNumber} across every account, including its metrics and equity history. Future MT5 uploads for this magic number will be ignored until you re-enable it. Deleted history cannot be restored, and other magic numbers are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {strategyActionError && <p role="alert" className="text-sm text-destructive" data-testid="status-pause-strategy-error">{strategyActionError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pauseMagicNumberMutation.isPending} data-testid="button-cancel-pause-strategy">Keep monitoring</AlertDialogCancel>
            <AlertDialogAction
              disabled={pauseMagicNumberMutation.isPending || strategyToPause === null}
              onClick={(event) => {
                event.preventDefault();
                if (strategyToPause) {
                  setStrategyActionError(null);
                  pauseMagicNumberMutation.mutate({ magicNumber: strategyToPause.magicNumber });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-pause-strategy"
            >
              {pauseMagicNumberMutation.isPending ? 'Pausing…' : 'Pause and delete history'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="fade-up mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] text-muted-foreground">An exact read on every Expert Advisor, grouped by magic number.</p>
          <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground"><Clock3 size={12}/> Last updated {updatedAt}{autoRefresh && <span className="ml-1 inline-flex items-center gap-1 text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary"/> Auto · {INTERVALS.find((item) => item.ms === intervalMs)?.label}</span>}</p>
        </div>
        {hasData && <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[.07] px-2.5 py-1 text-[10px] font-medium text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> Data connected</div>}
      </div>

      {query.isError && <div className="panel mb-5 flex flex-col gap-4 rounded-xl border-rose-500/25 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="mt-0.5 rounded-lg bg-rose-500/10 p-2 text-rose-300"><AlertCircle size={18}/></div>
          <div><h2 className="text-sm font-semibold">Dashboard data could not be loaded</h2><p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">The MT5 analytics service did not respond. Check the API connection, then retry. Your dashboard will populate once trade history is available.</p></div>
        </div>
        <button type="button" onClick={() => query.refetch()} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:opacity-90" data-testid="button-retry"><RefreshCw size={14}/> Try again</button>
      </div>}

      <section aria-label="Account-wide performance summary" className="fade-up-delay">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><WalletCards size={14} className="text-primary"/><h2 className="text-[12px] font-semibold tracking-wide">ACCOUNT SUMMARY</h2></div>
          <span className="text-[10px] text-muted-foreground">All strategies · all closed trades</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {[
            { label: 'Net profit', value: hasData ? money(data.totals.netProfit) : '—', detail: 'profit + commission + swap', icon: data && data.totals.netProfit < 0 ? <ArrowDownRight size={14}/> : <ArrowUpRight size={14}/>, tone: hasData ? data!.totals.netProfit >= 0 ? 'positive' as const : 'negative' as const : 'neutral' as const },
            { label: 'Avg net / trade', value: hasData ? money(data.totals.tradeCount > 0 ? data.totals.netProfit / data.totals.tradeCount : 0) : '—', detail: 'net profit ÷ closed trades', icon: <TrendingUp size={14}/>, tone: hasData ? data!.totals.netProfit >= 0 ? 'positive' as const : 'negative' as const : 'neutral' as const },
            { label: 'Profit factor', value: hasData ? pfLabel(data.totals.profitFactor, { losses: data!.totals.losses, netProfit: data!.totals.netProfit }) : '—', detail: 'gross wins ÷ gross losses', icon: <TrendingUp size={14}/> },
            { label: 'Win rate', value: hasData ? percent(data.totals.winRate) : '—', detail: hasData ? `${data.totals.wins} wins · ${data.totals.losses} losses` : 'Closed trades', icon: <BarChart3 size={14}/> },
            { label: 'Max drawdown', value: hasData ? money(data.totals.maxDrawdown) : '—', detail: 'Peak-to-trough', icon: <ArrowDownRight size={14}/>, tone: 'negative' as const },
            { label: 'Strategies', value: hasData ? String(data.totals.magicNumberCount) : '—', detail: 'Unique magic numbers', icon: <Activity size={14}/> },
            { label: 'Closed trades', value: hasData ? data.totals.tradeCount.toLocaleString() : '—', detail: hasData ? `${data.totals.wins} wins · ${data.totals.losses} losses` : 'No trades received', icon: <Clock3 size={14}/> },
          ].map((item) => <MetricTile key={item.label} {...item}/>)}
        </div>
        {hasData && <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CircleHelp size={12} className="text-primary"/> Net profit is realized profit + commission + swap.</span>
          <span>Per-trade P&amp;L Sharpe: mean ÷ standard deviation; not annualized.</span>
          <span>Account Sharpe <b className="mono text-foreground">{metric(data.totals.sharpeRatio)}</b></span>
          <span>Payout ratio <b className="mono text-foreground">{data.totals.payoutRatio == null ? '—' : `${metric(data.totals.payoutRatio)}×`}</b></span>
        </div>}
      </section>

      <div className="mb-3 mt-8 flex flex-wrap items-end justify-between gap-2">
        <div><div className="flex items-center gap-2"><BarChart3 size={15} className="text-primary"/><h2 className="text-[13px] font-semibold tracking-wide">STRATEGY BREAKDOWN</h2></div><p className="mt-1 text-[10px] text-muted-foreground">One performance profile per MT5 magic number.</p></div>
        {hasData && <span className="mono text-[10px] text-muted-foreground">{orderedStrategies.length} {orderedStrategies.length === 1 ? 'strategy' : 'strategies'}</span>}
      </div>
      {pausedMagicNumbers.length > 0 && <section className="panel mb-4 rounded-xl p-4 sm:p-5" aria-label="Paused strategies" data-testid="panel-paused-strategies">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Paused strategies</h3>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">New MT5 trades for these magic numbers are ignored. Re-enabling starts collecting new trades again; deleted history will not return.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pausedMagicNumbers.map((magicNumber) => {
              const isResuming = resumeMagicNumberMutation.isPending
                && resumeMagicNumberMutation.variables?.magicNumber === magicNumber;
              return <div key={magicNumber} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 py-1 pl-2.5 pr-1">
                <span className="mono text-[11px] font-semibold">Magic #{magicNumber}</span>
                <button
                  type="button"
                  onClick={() => {
                    setResumeError(null);
                    resumeMagicNumberMutation.mutate({ magicNumber });
                  }}
                  disabled={resumeMagicNumberMutation.isPending || pauseMagicNumberMutation.isPending}
                  className="inline-flex h-7 items-center rounded-md bg-primary/15 px-2 text-[10px] font-semibold text-primary transition hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Re-enable monitoring for magic number ${magicNumber}`}
                  data-testid={`button-resume-strategy-${magicNumber}`}
                >{isResuming ? 'Re-enabling…' : 'Re-enable'}</button>
              </div>;
            })}
          </div>
        </div>
        {resumeError && <p role="alert" className="mt-3 text-xs text-destructive" data-testid="status-resume-strategy-error">{resumeError}</p>}
      </section>}
      {loading && !data ? <div className="space-y-3" aria-label="Loading dashboard">
        {[0, 1].map((item) => <div key={item} className="panel animate-pulse rounded-2xl p-5">
          <div className="flex justify-between"><div className="h-5 w-44 rounded bg-muted"/><div className="h-6 w-24 rounded bg-muted"/></div>
          <div className="mt-5 grid grid-cols-3 gap-3 md:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-12 rounded bg-muted/80"/>)}</div>
          <div className="mt-5 h-48 rounded-lg bg-muted/60"/>
        </div>)}
      </div> : null}
      {hasData && orderedStrategies.length > 0 && <div className="space-y-3.5">
        {orderedStrategies.map((strategy) => <StrategyPanel
          key={strategy.magicNumber}
          strategy={strategy}
          light={light}
          onPause={(selected) => {
            setStrategyActionError(null);
            setStrategyToPause(selected);
          }}
          pausePending={pauseMagicNumberMutation.isPending || clearTradesMutation.isPending || resumeMagicNumberMutation.isPending}
        />)}
      </div>}
      {!loading && !query.isError && !hasData && <div className="panel fine-grid relative overflow-hidden rounded-2xl p-6 sm:p-9">
        <div className="absolute right-6 top-3 hidden select-none font-display text-[110px] font-extrabold leading-none tracking-[-.08em] text-primary/[.045] sm:block">MT5</div>
        <div className="relative max-w-2xl">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BarChart3 size={21}/></div>
          {pausedMagicNumbers.length === 0 ? <>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[.17em] text-primary">Awaiting first trade history</div>
            <h3 className="font-display text-[22px] font-bold tracking-[-.05em] sm:text-[27px]">Your strategies will appear here.</h3>
            <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted-foreground">No closed trades have been received yet. Connect your MT5 history ingestion to begin reviewing each Expert Advisor by its magic number. Metrics remain blank until real trade data arrives.</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border/80 bg-card/75 p-3"><div className="mono text-[10px] text-primary">01 / ALLOW</div><div className="mt-1 text-xs font-medium">Allow the dashboard URL</div><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">In MT5, open Tools → Options → Expert Advisors and add this site to the WebRequest allowlist.</p></div>
              <div className="rounded-lg border border-border/80 bg-card/75 p-3"><div className="mono text-[10px] text-primary">02 / MAP</div><div className="mt-1 text-xs font-medium">Keep each magic number</div><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">The EA sends closed trades with magic_number, close_time, and profit.</p></div>
              <div className="rounded-lg border border-border/80 bg-card/75 p-3"><div className="mono text-[10px] text-primary">03 / POST</div><div className="mt-1 text-xs font-medium">Send trade history</div><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">POST JSON with Content-Type: application/json. Repeated tickets are ignored per account.</p></div>
            </div>
          </> : <>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[.17em] text-primary">No active strategy history</div>
            <h3 className="font-display text-[22px] font-bold tracking-[-.05em] sm:text-[27px]">All strategy history is paused.</h3>
            <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted-foreground">Re-enable a magic number above to accept future MT5 trades. Its strategy card will return after a new trade is submitted; deleted history cannot be recovered.</p>
          </>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => query.refetch()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90" data-testid="button-check-for-trades"><RefreshCw size={13}/> Check for trades</button>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"><ExternalLink size={12}/> No sample metrics are shown.</span>
          </div>
        </div>
      </div>}

      {hasData && <p className="mt-4 text-center text-[10px] text-muted-foreground">Net profit includes realized profit, commission and swap. Sharpe uses per-trade P&amp;L divided by its standard deviation and is not annualized.</p>}
      <details id="webhook-setup" open={!hasData} className="panel mt-7 overflow-hidden rounded-xl" data-testid="webhook-setup">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <span><span className="text-[12px] font-semibold">MT5 webhook setup</span><span className="ml-2 text-[10px] text-muted-foreground">Send closed-trade JSON to your dashboard</span></span>
          <span className="inline-flex items-center gap-2">
            <span className="mono rounded-md border border-border bg-background/80 px-2 py-1 text-[10px] text-primary">POST /api/trades</span>
            <span aria-hidden="true" className="text-muted-foreground">⌄</span>
          </span>
        </summary>
        <div className="grid gap-4 border-t border-border/70 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Webhook URL</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-background/80 px-2.5 py-2 text-[11px] text-foreground">{webhookUrl}</code>
              <button type="button" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(webhookUrl);
                  setUrlCopied(true);
                  setCopyError(false);
                  window.setTimeout(() => setUrlCopied(false), 1800);
                } catch {
                  setCopyError(true);
                  setUrlCopied(false);
                }
              }} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background/80 px-3 text-[11px] text-muted-foreground hover:text-foreground" aria-label="Copy webhook URL" data-testid="button-copy-webhook-url">
                {urlCopied ? <Check size={13}/> : <Download size={13}/>}
                {urlCopied ? 'Copied' : copyError ? 'Copy failed' : 'Copy URL'}
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">In MT5, allow the site origin above under Tools → Options → Expert Advisors → Allow WebRequest for listed URL. Send timestamps as ISO 8601 UTC.</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Example request body</p>
            <pre className="mono mt-1.5 overflow-x-auto rounded-md border border-border bg-background/80 p-3 text-[10px] leading-relaxed text-foreground"><code>{`{
  "account_id": "mt5-main",
  "trades": [{
    "ticket": "123456789",
    "magic_number": 26001,
    "symbol": "EURUSD",
    "type": "buy",
    "volume": 0.10,
    "close_time": "2026-01-14T15:30:00Z",
    "profit": 24.50,
    "commission": -0.70,
    "swap": 0
  }]
}`}</code></pre>
            <p className="mt-1.5 text-[10px] text-muted-foreground">Net profit is profit + commission + swap. ticket is optional; ticket deduplication is scoped by account_id.</p>
          </div>
        </div>
      </details>
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> MT5 analytics workspace</span>
        <span>Precision over prediction.</span>
      </footer>
    </div>
  </main>;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
