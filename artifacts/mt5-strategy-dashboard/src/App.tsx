import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { StrategyBoardTile } from '@/components/strategy-board-tile';
import './strategy-board-theme.css';
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
import { previewDemoDashboard } from '@/lib/preview-demo';
import type { StrategyPerformance } from '@workspace/api-client-react';
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from 'recharts';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Check,
  ChevronDown, CircleHelp, Clock3, Copy, ExternalLink,
  Minus, Plus, RefreshCw, ShieldAlert, Trash2, TrendingUp, X,
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
const FONT_SCALE_STORAGE_KEY = 'mt5-strategy-dashboard-font-scale-v1';
const MIN_FONT_SCALE = 0.8;
const MAX_FONT_SCALE = 1.3;
const FONT_SCALE_STEP = 0.1;
type FontScaleElement = HTMLElement | SVGElement;
type InlineFontSize = { value: string; priority: string };
const fontBaselines = new WeakMap<FontScaleElement, number>();
const originalInlineFontSizes = new WeakMap<FontScaleElement, InlineFontSize>();
const scaledFontElements = new Set<FontScaleElement>();

function applySiteFontScale(scale: number) {
  for (const element of scaledFontElements) {
    const original = originalInlineFontSizes.get(element);
    if (original?.value) {
      element.style.setProperty('font-size', original.value, original.priority);
    } else {
      element.style.removeProperty('font-size');
    }
  }
  scaledFontElements.clear();

  const textElements = new Set<FontScaleElement>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode;
    if (!text.textContent?.trim()) continue;
    const owner = text.parentNode;
    if (owner instanceof HTMLElement || owner instanceof SVGElement) textElements.add(owner);
  }

  for (const element of textElements) {
    if (!originalInlineFontSizes.has(element)) {
      originalInlineFontSizes.set(element, {
        value: element.style.getPropertyValue('font-size'),
        priority: element.style.getPropertyPriority('font-size'),
      });
    }
    const baseline = Number.parseFloat(getComputedStyle(element).fontSize);
    if (!Number.isFinite(baseline)) continue;
    fontBaselines.set(element, baseline);
    scaledFontElements.add(element);
  }
  for (const element of scaledFontElements) {
    element.style.setProperty('font-size', `${fontBaselines.get(element)! * scale}px`, 'important');
  }
}

function readSavedFontScale() {
  try {
    const value = window.localStorage.getItem(FONT_SCALE_STORAGE_KEY);
    if (value === null) return 1;
    const saved = Number(value);
    return Number.isFinite(saved)
      ? Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, saved))
      : 1;
  } catch {
    return 1;
  }
}

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

const isPreviewDemo = import.meta.env.DEV;
const STRATEGY_ORDER_STORAGE_KEY = isPreviewDemo
  ? 'mt5-strategy-dashboard-preview-order-v1'
  : 'mt5-strategy-dashboard-order-v1';

function readSavedStrategyOrder() {
  try {
    const saved = window.localStorage.getItem(STRATEGY_ORDER_STORAGE_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((value): value is number => Number.isSafeInteger(value)))]
      : [];
  } catch {
    return [];
  }
}

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
  return <div className={`sb-account-metric ${tone === 'positive' ? 'sb-account-accent' : ''}`}>
    <div className="sb-metric-top">
      <span>{label}</span>
      <i>{icon}</i>
    </div>
    <strong className={tone === 'negative' ? 'is-negative' : ''} data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
      {value}
    </strong>
    {detail && <small>{detail}</small>}
  </div>;
}

function EquityChart({ strategy }: { strategy: StrategyPerformance }) {
  const points = useMemo(() => [...strategy.equity].sort(
    (a, b) => new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime(),
  ), [strategy.equity]);
  const stroke = strategy.netProfit >= 0 ? '#63d6a9' : '#f08a81';
  const grid = 'rgba(175,192,205,.11)';
  const ticks = '#8897a4';
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
            contentStyle={{ background: '#151d24', border: '1px solid #2b3943', borderRadius: 12, color: '#e3e9eb', fontSize: 12 }}
            labelFormatter={(label) => new Date(String(label)).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            formatter={(value, name) => [money(Number(value)), name === 'cumulativeProfit' ? 'Cumulative net profit' : 'Trade net profit']}
          />
          <Area type="monotone" dataKey="cumulativeProfit" name="Cumulative net profit" stroke={stroke} strokeWidth={2} fill={`url(#${id})`} activeDot={{ r: 4, fill: stroke, stroke: '#151d24', strokeWidth: 2 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    )}
  </div>;
}

function Home() {
  const [fontScale, setFontScale] = useState(readSavedFontScale);
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
  const [pausedStrategiesOpen, setPausedStrategiesOpen] = useState(true);
  const [strategyOrder, setStrategyOrder] = useState<number[]>(readSavedStrategyOrder);
  const [draggedMagicNumber, setDraggedMagicNumber] = useState<number | null>(null);
  const [dropTargetMagicNumber, setDropTargetMagicNumber] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    applySiteFontScale(fontScale);
  }, [fontScale]);
  useEffect(() => {
    try {
      window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(fontScale));
    } catch {
      console.warn('Font size could not be saved in this browser.');
    }
  }, [fontScale]);
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => applySiteFontScale(fontScale));
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [fontScale]);
  const query = useGetTradesDashboard({
    query: {
      queryKey: isPreviewDemo ? ['mt5-preview-demo-dashboard'] : getGetTradesDashboardQueryKey(),
      enabled: !isPreviewDemo,
      initialData: isPreviewDemo ? previewDemoDashboard : undefined,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchInterval: !isPreviewDemo && autoRefresh ? intervalMs : false,
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
  const updatedAt = isPreviewDemo ? 'Demo data · not synced' : timestamp(query.dataUpdatedAt);
  useEffect(() => {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  }, []);
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, []);
  useEffect(() => {
    if (!strategyOrder.length) return;
    try {
      window.localStorage.setItem(STRATEGY_ORDER_STORAGE_KEY, JSON.stringify(strategyOrder));
    } catch {
      console.warn('Strategy order could not be saved in this browser.');
    }
  }, [strategyOrder]);
  const orderedStrategies = useMemo(() => {
    if (!data) return [];
    const remaining = new Map(data.strategies.map((strategy) => [strategy.magicNumber, strategy]));
    const saved = strategyOrder.flatMap((magicNumber) => {
      const strategy = remaining.get(magicNumber);
      if (!strategy) return [];
      remaining.delete(magicNumber);
      return [strategy];
    });
    return [...saved, ...[...remaining.values()].sort((a, b) => b.netProfit - a.netProfit)];
  }, [data, strategyOrder]);
  const reorderStrategy = (source: number, target: number) => {
    const order = orderedStrategies.map((strategy) => strategy.magicNumber);
    const sourceIndex = order.indexOf(source);
    const targetIndex = order.indexOf(target);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const [moved] = order.splice(sourceIndex, 1);
    order.splice(targetIndex, 0, moved);
    setStrategyOrder(order);
  };

  return <main id="sb-current-root" className="dashboard-shell strategy-board" data-testid="strategy-board">
    <div className="sb-wrap">
      <header className="sb-topline fade-up">
        <div className="sb-brand">
          <div className="sb-mark">
            <Activity size={21} strokeWidth={1.8}/>
          </div>
          <div className="sb-brand-copy">
            <p>MT5 / ANALYTICS</p>
            <h1>Strategy board <small>Terminal JFN</small></h1>
          </div>
        </div>
        <div className="sb-actions print-hidden">
          <div ref={menuRef} className="relative">
            <div className="flex gap-[7px]">
              <button type="button" onClick={() => query.refetch()} disabled={loading || isPreviewDemo} className="sb-btn sb-btn-primary" data-testid="button-refresh">
                <RefreshCw size={14} className={query.isFetching ? 'animate-spin text-primary' : ''}/> Refresh
              </button>
              <button type="button" onClick={() => setMenuOpen((open) => !open)} className="sb-btn sb-icon-btn" aria-label="Dashboard settings" aria-expanded={menuOpen} data-testid="button-dashboard-settings">
                {autoRefresh ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> : null}
                <ChevronDown size={14}/>
              </button>
            </div>
            {menuOpen && <div className="sb-menu rounded-xl">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div><div className="text-xs font-semibold">Auto-refresh</div><div className="mt-0.5 text-[10px] text-muted-foreground">Off by default</div></div>
                <button type="button" role="switch" aria-checked={autoRefresh} disabled={isPreviewDemo} onClick={() => setAutoRefresh((value) => !value)} className={`relative h-5 w-9 rounded-full transition ${autoRefresh ? 'bg-primary' : 'bg-muted'}`} data-testid="toggle-auto-refresh">
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${autoRefresh ? 'translate-x-[18px]' : 'translate-x-0.5'}`}/>
                </button>
              </div>
              <div className={`space-y-0.5 pt-2 ${!autoRefresh ? 'pointer-events-none opacity-45' : ''}`}>
                <div className="px-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Interval</div>
                {INTERVALS.map((option) => <button key={option.ms} type="button" onClick={() => { setIntervalMs(option.ms); setMenuOpen(false); }} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted" data-testid={`interval-${option.ms}`}>
                  {option.label}{intervalMs === option.ms && <Check size={13} className="text-primary"/>}
                </button>)}
              </div>
              <div className="mt-2 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground">{isPreviewDemo ? 'Refresh and trade controls are disabled in this local sample preview.' : 'Automatic checks run no more often than every 5 minutes.'}</div>
            </div>}
          </div>
          <button type="button" disabled={isPreviewDemo || pauseMagicNumberMutation.isPending} title={isPreviewDemo ? 'Disabled in the local sample preview' : undefined} onClick={() => {
            if (isPreviewDemo) return;
            setClearTradeError(null);
            setMenuOpen(false);
            setClearDialogOpen(true);
          }} className="sb-btn sb-btn-danger" aria-label="Clear all trades" data-testid="button-clear-all-trades">
            <Trash2 size={14}/><span>Clear trades</span>
          </button>
          <div className="sb-font-controls" role="group" aria-label="Site font size">
            <button type="button" className="sb-btn sb-icon-btn" aria-label="Decrease site font size" title="Decrease font size" disabled={fontScale <= MIN_FONT_SCALE} onClick={() => setFontScale((value) => Math.max(MIN_FONT_SCALE, Number((value - FONT_SCALE_STEP).toFixed(1))))} data-testid="button-decrease-font"><Minus size={15}/></button>
            <span className="sb-font-scale mono" role="status" aria-live="polite" data-testid="font-size-value">{Math.round(fontScale * 100)}%</span>
            <button type="button" className="sb-btn sb-icon-btn" aria-label="Increase site font size" title="Increase font size" disabled={fontScale >= MAX_FONT_SCALE} onClick={() => setFontScale((value) => Math.min(MAX_FONT_SCALE, Number((value + FONT_SCALE_STEP).toFixed(1))))} data-testid="button-increase-font"><Plus size={15}/></button>
          </div>
        </div>
      </header>
      <div className="sb-sample-ribbon">
        <p><span className="sb-sample-label">{isPreviewDemo ? 'PREVIEW · SAMPLE DATA' : query.isError ? 'CONNECTION ERROR' : hasData ? 'LIVE DATA' : 'MT5 CONNECTION'}</span> <span className="ml-2">{isPreviewDemo ? 'Illustrative trades only · nothing is sent to MT5 or saved' : hasData ? 'Realized results from closed trades · no sample metrics' : loading ? 'Loading your trade history…' : 'Waiting for closed-trade history'}</span></p>
        <div className="sb-live-state"><i/><b>{orderedStrategies.length} ACTIVE</b><span>/</span><span>{pausedMagicNumbers.length} PAUSED</span><span>/</span><span>{data?.totals.tradeCount ?? 0} closes</span></div>
      </div>
      {trackingNotice && <div role="status" className="sb-notice" data-testid="status-strategy-tracking">
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
              disabled={isPreviewDemo || clearTradesMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (isPreviewDemo) return;
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
              disabled={isPreviewDemo || pauseMagicNumberMutation.isPending || strategyToPause === null}
              onClick={(event) => {
                event.preventDefault();
                if (!isPreviewDemo && strategyToPause) {
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

      <div className="sb-hero fade-up">
        <div>
          <span className="sb-kicker">ACCOUNT OVERVIEW / REALIZED PERFORMANCE</span>
          <h2>Every magic number.<br/>A clear read.</h2>
          <p>Exact closed-trade results, grouped by Expert Advisor identifier.</p>
        </div>
        <div className="sb-last-sync"><span>LAST UPDATED</span><strong className="inline-flex items-center gap-1"><Clock3 size={12}/>{updatedAt}</strong>{autoRefresh && <span className="mt-1 block text-primary">Auto · {INTERVALS.find((item) => item.ms === intervalMs)?.label}</span>}</div>
      </div>

      {query.isError && <div className="panel mb-5 flex flex-col gap-4 rounded-xl border-rose-500/25 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="mt-0.5 rounded-lg bg-rose-500/10 p-2 text-rose-300"><AlertCircle size={18}/></div>
          <div><h2 className="text-sm font-semibold">Dashboard data could not be loaded</h2><p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">The MT5 analytics service did not respond. Check the API connection, then retry. Your dashboard will populate once trade history is available.</p></div>
        </div>
        <button type="button" onClick={() => query.refetch()} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:opacity-90" data-testid="button-retry"><RefreshCw size={14}/> Try again</button>
      </div>}

      <section aria-label="Account-wide performance summary" className="sb-overview fade-up-delay">
        <div className="sb-section-heading">
          <div className="sb-section-title"><i>01</i><h3>ACCOUNT PERFORMANCE</h3></div>
          <span className="sb-section-note">All strategies · all closed trades</span>
        </div>
        <div className="sb-account-grid">
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
        {hasData && <div className="sb-method">
          <span className="inline-flex items-center gap-1.5"><CircleHelp size={12} className="text-primary"/> Net profit is realized profit + commission + swap.</span>
          <span>Per-trade P&amp;L Sharpe: mean ÷ standard deviation; not annualized.</span>
          <span>Account Sharpe <b className="mono text-foreground">{metric(data.totals.sharpeRatio)}</b></span>
          <span>Payout ratio <b className="mono text-foreground">{data.totals.payoutRatio == null ? '—' : `${metric(data.totals.payoutRatio)}×`}</b></span>
        </div>}
      </section>

      <div className="sb-board-heading">
        <div><h2>Strategy units</h2><p>One operating record per magic number · drag or use arrows to reorder · order saved in this browser.</p></div>
        {hasData && <span className="sb-order-chip mono">{orderedStrategies.length} UNITS / DRAG TO MOVE</span>}
      </div>
      {loading && !data ? <div className="space-y-3" aria-label="Loading dashboard">
        {[0, 1].map((item) => <div key={item} className="panel animate-pulse rounded-2xl p-5">
          <div className="flex justify-between"><div className="h-5 w-44 rounded bg-muted"/><div className="h-6 w-24 rounded bg-muted"/></div>
          <div className="mt-5 grid grid-cols-3 gap-3 md:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-12 rounded bg-muted/80"/>)}</div>
          <div className="mt-5 h-48 rounded-lg bg-muted/60"/>
        </div>)}
      </div> : null}
      {hasData && orderedStrategies.length > 0 && <div className="sb-units">
        {orderedStrategies.map((strategy, index) => <StrategyBoardTile
          key={strategy.magicNumber}
          strategy={strategy}
          index={index}
          count={orderedStrategies.length}
          chart={<EquityChart strategy={strategy}/>}
          onMove={(direction) => {
            const target = orderedStrategies[index + direction];
            if (target) reorderStrategy(strategy.magicNumber, target.magicNumber);
          }}
          onDropReorder={reorderStrategy}
          onDragStart={(magicNumber) => {
            setDraggedMagicNumber(magicNumber);
            setDropTargetMagicNumber(null);
          }}
          onDragOver={setDropTargetMagicNumber}
          onDragEnd={() => {
            setDraggedMagicNumber(null);
            setDropTargetMagicNumber(null);
          }}
          isDragging={draggedMagicNumber === strategy.magicNumber}
          isDropTarget={dropTargetMagicNumber === strategy.magicNumber && draggedMagicNumber !== strategy.magicNumber}
          onPause={() => {
            setStrategyActionError(null);
            setStrategyToPause(strategy);
          }}
           pausePending={isPreviewDemo || pauseMagicNumberMutation.isPending || clearTradesMutation.isPending || resumeMagicNumberMutation.isPending}
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
            <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted-foreground">Re-enable a magic number below to accept future MT5 trades. Its strategy card will return after a new trade is submitted; deleted history cannot be recovered.</p>
          </>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => query.refetch()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90" data-testid="button-check-for-trades"><RefreshCw size={13}/> Check for trades</button>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"><ExternalLink size={12}/> No sample metrics are shown.</span>
          </div>
        </div>
      </div>}

      {pausedMagicNumbers.length > 0 && <details
        open={pausedStrategiesOpen}
        onToggle={(event) => setPausedStrategiesOpen(event.currentTarget.open)}
        className="sb-paused"
        aria-label="Paused strategies"
        data-testid="panel-paused-strategies"
      >
        <summary data-testid="toggle-paused-strategies">
          <div>
            <div className="sb-paused-title"><ShieldAlert size={14} /> Paused magic numbers <b>{pausedMagicNumbers.length}</b></div>
            <p>Re-enable to accept future MT5 uploads. Deleted history will not return.</p>
          </div>
          <ChevronDown size={15}/>
        </summary>
        <div className="sb-paused-content">
          {pausedMagicNumbers.map((magicNumber) => {
            const isResuming = resumeMagicNumberMutation.isPending
              && resumeMagicNumberMutation.variables?.magicNumber === magicNumber;
            return <div key={magicNumber} className="sb-paused-item">
              <span className="sb-paused-number">Magic #{magicNumber}</span>
              <button
                type="button"
                onClick={() => {
                  if (isPreviewDemo) return;
                  setResumeError(null);
                  resumeMagicNumberMutation.mutate({ magicNumber });
                }}
                disabled={isPreviewDemo || resumeMagicNumberMutation.isPending || pauseMagicNumberMutation.isPending}
                aria-label={`Re-enable monitoring for magic number ${magicNumber}`}
                data-testid={`button-resume-strategy-${magicNumber}`}
              >{isResuming ? 'Re-enabling…' : 'Re-enable'}</button>
            </div>;
          })}
        </div>
        {resumeError && <p role="alert" className="mt-3 px-3 pb-2 text-xs text-destructive" data-testid="status-resume-strategy-error">{resumeError}</p>}
      </details>}
      {hasData && <p className="sb-footnote mt-4 text-center text-[10px] text-muted-foreground">Net profit includes realized profit, commission and swap. Sharpe uses per-trade P&amp;L divided by its standard deviation and is not annualized.</p>}
      <details id="webhook-setup" open={!hasData} className="sb-webhook" data-testid="webhook-setup">
        <summary>
          <span className="sb-webhook-title">MT5 webhook setup<small>Send closed-trade JSON to your dashboard</small></span>
          <span className="sb-endpoint">POST /api/trades</span>
        </summary>
        <div className="sb-webhook-content">
          <div className="min-w-0">
            <p>Configure your MT5 Expert Advisor to post closed-trade records to the trade endpoint. Send timestamps as ISO 8601 UTC.</p>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider">Webhook URL</p>
            <code className="mt-1.5 block break-all">{webhookUrl}</code>
            <p className="mt-2 text-[10px]">In MT5, allow the site origin above under Tools → Options → Expert Advisors → Allow WebRequest for listed URL.</p>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider">Example request body</p>
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
          }} aria-label="Copy webhook URL" data-testid="button-copy-webhook-url">
            <Copy size={13}/>
            {urlCopied ? 'Copied' : copyError ? 'Copy failed' : 'Copy URL'}
          </button>
        </div>
      </details>
      <footer className="sb-footnote mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
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
