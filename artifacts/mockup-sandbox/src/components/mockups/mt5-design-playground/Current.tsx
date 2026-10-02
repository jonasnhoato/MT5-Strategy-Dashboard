import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from 'recharts';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Check,
  ChevronDown, ChevronUp, CircleHelp, Clock3, Download,
  GripVertical, Moon, Printer, RefreshCw, Sun, Trash2, TrendingUp,
  WalletCards, X,
} from 'lucide-react';
import { fixture, money, percent, type StrategyPerformance } from './_fixture';
import './_group.css';

const INTERVALS = [
  { label: '5 minutes', ms: 5 * 60 * 1000 },
  { label: '15 minutes', ms: 15 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
];
const compactMoney = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
}).format(value);
const metric = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};
const timestamp = (value?: string) => value
  ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  : 'Waiting for first sync';
const equityCsvHeaders = [
  { label: 'close_time', key: 'closeTime' },
  { label: 'trade_net_profit', key: 'netProfit' },
  { label: 'cumulative_net_profit', key: 'cumulativeProfit' },
];

function downloadEquityCsv(strategy: StrategyPerformance) {
  const rows = [
    equityCsvHeaders.map(({ label }) => label).join(','),
    ...strategy.equity.map((point) => [
      point.closeTime,
      point.netProfit,
      point.cumulativeProfit,
    ].join(',')),
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `magic-${strategy.magicNumber}-net-profit-equity.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function pfLabel(value: number | null, strategy?: Pick<StrategyPerformance, 'losses' | 'netProfit'>) {
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
            cursor={{ stroke, strokeDasharray: '3 4', strokeOpacity: .5 }}
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

function StrategyPanel({
  strategy, light, onPause, orderIndex, strategyCount, onMove, onReorder,
  onDragStart, onDragEnd, onDragOver, isDragging, isDropTarget,
}: {
  strategy: StrategyPerformance;
  light: boolean;
  onPause: (strategy: StrategyPerformance) => void;
  orderIndex: number;
  strategyCount: number;
  onMove: (direction: -1 | 1) => void;
  onReorder: (source: number, target: number) => void;
  onDragStart: (magicNumber: number) => void;
  onDragEnd: () => void;
  onDragOver: (magicNumber: number) => void;
  isDragging: boolean;
  isDropTarget: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const positive = strategy.netProfit >= 0;
  const symbols = strategy.symbols ?? [];
  const summaryStats = [
    { label: 'Net profit', value: money(strategy.netProfit), tone: positive ? 'positive' : 'negative' },
    { label: 'Closed trades', value: strategy.tradeCount.toLocaleString(), tone: 'neutral' },
    { label: 'Win rate', value: percent(strategy.winRate), tone: 'neutral' },
    { label: 'Profit factor', value: pfLabel(strategy.profitFactor, strategy), tone: 'neutral' },
  ] as const;
  const detailStats = [
    ['Max drawdown', money(strategy.maxDrawdown)],
    ['Avg net / trade', money(strategy.tradeCount > 0 ? strategy.netProfit / strategy.tradeCount : 0)],
    ['Sharpe ratio', metric(strategy.sharpeRatio)],
    ['Payout ratio', strategy.payoutRatio == null ? '—' : `${metric(strategy.payoutRatio)}×`],
    ['Wins / losses', `${strategy.wins} / ${strategy.losses}`],
  ];
  const detailsId = `strategy-details-${strategy.magicNumber}`;

  return <section
    className={`panel overflow-hidden rounded-2xl transition-shadow ${expanded ? 'sm:col-span-2 xl:col-span-3' : ''} ${isDropTarget ? 'ring-2 ring-primary/60' : ''} ${isDragging ? 'opacity-60' : ''}`}
    data-testid={`strategy-${strategy.magicNumber}`}
    onDragOver={(event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (!isDropTarget) onDragOver(strategy.magicNumber);
    }}
    onDrop={(event) => {
      event.preventDefault();
      const sourceValue = event.dataTransfer.getData('text/plain');
      const source = Number(sourceValue);
      if (sourceValue && Number.isSafeInteger(source) && source !== strategy.magicNumber) onReorder(source, strategy.magicNumber);
      onDragEnd();
    }}
  >
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 px-4 py-3.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><Activity size={16}/></div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-display text-[14px] font-semibold tracking-[-.03em]">Magic <span className="mono text-primary">{strategy.magicNumber}</span></h3>
            {symbols.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1" aria-label={`Assets traded by magic number ${strategy.magicNumber}`}>
                {symbols.map((symbol) => <span key={symbol} title={`Traded asset: ${symbol}`} className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-primary">{symbol}</span>)}
              </div>
            ) : <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">No ticker data</span>}
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Expert Advisor · {strategy.breakeven} breakeven</p>
        </div>
      </div>
      <div className="print-hidden flex shrink-0 items-center gap-1">
        <button type="button" draggable onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', String(strategy.magicNumber));
          onDragStart(strategy.magicNumber);
        }} onDragEnd={onDragEnd} className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground transition hover:border-primary/40 hover:text-foreground active:cursor-grabbing" aria-label={`Drag magic number ${strategy.magicNumber} to reorder`} title="Drag to reorder" data-testid={`button-drag-strategy-${strategy.magicNumber}`}><GripVertical size={15}/></button>
        <div className="flex flex-col">
          <button type="button" onClick={() => onMove(-1)} disabled={orderIndex === 0} className="flex h-4 w-6 items-center justify-center rounded-t border border-border bg-muted/40 text-muted-foreground transition hover:text-foreground disabled:opacity-30" aria-label={`Move magic number ${strategy.magicNumber} up`} data-testid={`button-move-strategy-up-${strategy.magicNumber}`}><ChevronUp size={12}/></button>
          <button type="button" onClick={() => onMove(1)} disabled={orderIndex === strategyCount - 1} className="-mt-px flex h-4 w-6 items-center justify-center rounded-b border border-border bg-muted/40 text-muted-foreground transition hover:text-foreground disabled:opacity-30" aria-label={`Move magic number ${strategy.magicNumber} down`} data-testid={`button-move-strategy-down-${strategy.magicNumber}`}><ChevronDown size={12}/></button>
        </div>
        <button type="button" onClick={() => onPause(strategy)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/[.07] px-2 text-[10px] font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/[.12]" aria-label={`Preview pause for magic number ${strategy.magicNumber}`} title="Pause is disabled in this local preview" data-testid={`button-delete-strategy-${strategy.magicNumber}`}><Trash2 size={12}/><span>Delete</span></button>
        {strategy.equity.length > 0 && <button type="button" onClick={() => downloadEquityCsv(strategy)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-muted/50 px-2 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground" aria-label={`Export magic number ${strategy.magicNumber} equity as CSV`} data-testid={`export-csv-${strategy.magicNumber}`}><Download size={12}/><span>CSV</span></button>}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-px bg-border/60">
      {summaryStats.map(({ label, value, tone }) => <div key={label} className="min-w-0 bg-card/95 px-3 py-2.5">
        <div className="metric-label !text-[9px]">{label}</div>
        <div className={`mono mt-1 truncate text-[13px] font-medium ${tone === 'positive' ? 'text-emerald-300' : tone === 'negative' ? 'text-rose-300' : 'text-foreground'}`}>{value}</div>
      </div>)}
    </div>
    <div className="px-3 pb-3 pt-2.5">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/35 px-3 py-2 text-left text-[11px] font-medium transition hover:border-primary/40 hover:bg-muted/60" aria-expanded={expanded} aria-controls={detailsId} data-testid={`button-toggle-details-${strategy.magicNumber}`}>
        <span>{expanded ? 'Hide full details' : 'View full details'}</span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}/>
      </button>
      <div id={detailsId} hidden={!expanded} className={`mt-3 border-t border-border/70 pt-3 ${expanded ? '' : 'hidden'}`}>
        {expanded && <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/60 sm:grid-cols-3 xl:grid-cols-5">
            {detailStats.map(([label, value]) => <div key={label} className="min-w-0 bg-card/95 px-3 py-2.5"><div className="metric-label !text-[9px]">{label}</div><div className="mono mt-1.5 truncate text-[12px] font-medium text-foreground">{value}</div></div>)}
          </div>
          <div className="pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div><div className="text-[12px] font-medium">Cumulative net profit</div><div className="mt-0.5 text-[10px] text-muted-foreground">Closed trades over time · account currency in USD</div></div>
              <span className="mono text-[10px] text-muted-foreground">{strategy.equity.length} points</span>
            </div>
            <EquityChart strategy={strategy} light={light}/>
          </div>
        </>}
      </div>
    </div>
  </section>;
}

export function Current() {
  const [light, setLight] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [intervalMs, setIntervalMs] = useState(INTERVALS[0].ms);
  const [menuOpen, setMenuOpen] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [pausedStrategiesOpen, setPausedStrategiesOpen] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [strategyOrder, setStrategyOrder] = useState<number[]>([]);
  const [draggedMagicNumber, setDraggedMagicNumber] = useState<number | null>(null);
  const [dropTargetMagicNumber, setDropTargetMagicNumber] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const data = fixture;
  const hasData = data.totals.tradeCount > 0 && data.strategies.length > 0;
  const webhookUrl = `${window.location.origin}/api/trades`;
  const updatedAt = timestamp(data.latestTradeAt);
  const orderedStrategies = useMemo(() => {
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

  return <main id="mt5-dashboard-root" className={`dashboard-shell min-h-[100dvh] bg-background ${light ? 'light' : 'dark'}`}>
    <div className="mx-auto max-w-[1480px] px-4 pb-12 pt-4 sm:px-6 sm:pt-6 lg:px-9">
      <div role="note" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/[.07] px-3 py-2 text-[10px] text-foreground">
        <span><b className="font-semibold text-primary">LOCAL SAMPLE</b> · illustrative MT5 metrics only — no backend connection or account data</span>
        <span className="mono text-muted-foreground">5 active · 2 paused · {data.totals.tradeCount} trades</span>
      </div>
      <header className="fade-up mb-7 flex flex-wrap items-center justify-between gap-5 border-b border-border/70 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Activity size={21} strokeWidth={1.8}/><span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-400"/>
          </div>
          <div><div className="flex items-center gap-2"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-primary">Terminal / analytics</p><span className="rounded border border-border/80 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-muted-foreground">MT5</span></div><h1 className="mt-0.5 font-display text-[22px] font-bold tracking-[-.055em] md:text-[26px]">Strategy performance</h1></div>
        </div>
        <div className="print-hidden flex flex-wrap items-center gap-2">
          <div ref={menuRef} className="relative">
            <div className="flex h-9 overflow-hidden rounded-lg border border-border bg-card">
              <button type="button" onClick={() => setNotice('Local sample fixture is shown; no refresh request was sent.')} className="flex items-center gap-2 px-3 text-[12px] font-medium transition hover:bg-muted" data-testid="button-refresh"><RefreshCw size={14}/> Refresh</button>
              <div className="my-2 w-px bg-border"/>
              <button type="button" onClick={() => setMenuOpen((open) => !open)} className="flex items-center gap-1.5 px-2.5 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Dashboard settings" aria-expanded={menuOpen} data-testid="button-dashboard-settings">{autoRefresh ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> : null}<ChevronDown size={14}/></button>
            </div>
            {menuOpen && <div className="absolute right-0 top-11 z-20 w-60 rounded-xl border border-border bg-popover p-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-border pb-3"><div><div className="text-xs font-semibold">Auto-refresh</div><div className="mt-0.5 text-[10px] text-muted-foreground">Local preview only</div></div><button type="button" role="switch" aria-checked={autoRefresh} onClick={() => setAutoRefresh((value) => !value)} className={`relative h-5 w-9 rounded-full transition ${autoRefresh ? 'bg-primary' : 'bg-muted'}`} data-testid="toggle-auto-refresh"><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${autoRefresh ? 'translate-x-[18px]' : 'translate-x-0.5'}`}/></button></div>
              <div className={`space-y-0.5 pt-2 ${!autoRefresh ? 'pointer-events-none opacity-45' : ''}`}><div className="px-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Interval</div>{INTERVALS.map((option) => <button key={option.ms} type="button" onClick={() => { setIntervalMs(option.ms); setMenuOpen(false); }} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted">{option.label}{intervalMs === option.ms && <Check size={13} className="text-primary"/>}</button>)}</div>
              <div className="mt-2 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground">No network polling is performed by this preview.</div>
            </div>}
          </div>
          <button type="button" onClick={() => setNotice('Clear all trades is disabled in the local sample preview.')} className="flex h-9 items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/[.07] px-3 text-[12px] font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/[.12]" aria-label="Clear all trades" data-testid="button-clear-all-trades"><Trash2 size={14}/><span>Clear all trades</span></button>
          <button type="button" onClick={() => window.print()} className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[12px] text-muted-foreground transition hover:text-foreground" aria-label="Export dashboard as PDF" data-testid="button-export-pdf"><Printer size={14}/><span className="hidden sm:inline">PDF</span></button>
          <button type="button" onClick={() => setLight((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:text-foreground" aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'} data-testid="button-toggle-theme">{light ? <Moon size={15}/> : <Sun size={15}/>}</button>
        </div>
      </header>
      {notice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/[.07] px-3 py-2 text-xs text-foreground" data-testid="status-strategy-tracking"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Dismiss strategy status"><X size={14}/></button></div>}
      <div className="fade-up mb-5 flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-[12px] text-muted-foreground">An exact read on every Expert Advisor, grouped by magic number.</p><p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground"><Clock3 size={12}/> Sample updated {updatedAt}{autoRefresh && <span className="ml-1 inline-flex items-center gap-1 text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary"/> Preview · {INTERVALS.find((item) => item.ms === intervalMs)?.label}</span>}</p></div>
        {hasData && <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[.07] px-2.5 py-1 text-[10px] font-medium text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> Sample data</div>}
      </div>
      <section aria-label="Account-wide performance summary" className="fade-up-delay">
        <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><WalletCards size={14} className="text-primary"/><h2 className="text-[12px] font-semibold tracking-wide">ACCOUNT SUMMARY</h2></div><span className="text-[10px] text-muted-foreground">All strategies · all closed trades</span></div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {[
            { label: 'Net profit', value: money(data.totals.netProfit), detail: 'profit + commission + swap', icon: data.totals.netProfit < 0 ? <ArrowDownRight size={14}/> : <ArrowUpRight size={14}/>, tone: data.totals.netProfit >= 0 ? 'positive' as const : 'negative' as const },
            { label: 'Avg net / trade', value: money(data.totals.tradeCount > 0 ? data.totals.netProfit / data.totals.tradeCount : 0), detail: 'net profit ÷ closed trades', icon: <TrendingUp size={14}/>, tone: data.totals.netProfit >= 0 ? 'positive' as const : 'negative' as const },
            { label: 'Profit factor', value: pfLabel(data.totals.profitFactor, { losses: data.totals.losses, netProfit: data.totals.netProfit }), detail: 'gross wins ÷ gross losses', icon: <TrendingUp size={14}/> },
            { label: 'Win rate', value: percent(data.totals.winRate), detail: `${data.totals.wins} wins · ${data.totals.losses} losses`, icon: <BarChart3 size={14}/> },
            { label: 'Max drawdown', value: money(data.totals.maxDrawdown), detail: 'Peak-to-trough', icon: <ArrowDownRight size={14}/>, tone: 'negative' as const },
            { label: 'Strategies', value: String(data.totals.magicNumberCount), detail: 'Unique magic numbers', icon: <Activity size={14}/> },
            { label: 'Closed trades', value: data.totals.tradeCount.toLocaleString(), detail: `${data.totals.wins} wins · ${data.totals.losses} losses`, icon: <Clock3 size={14}/> },
          ].map((item) => <MetricTile key={item.label} {...item}/>)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CircleHelp size={12} className="text-primary"/> Net profit is realized profit + commission + swap.</span><span>Per-trade P&amp;L Sharpe: mean ÷ standard deviation; not annualized.</span><span>Account Sharpe <b className="mono text-foreground">{metric(data.totals.sharpeRatio)}</b></span><span>Payout ratio <b className="mono text-foreground">{data.totals.payoutRatio == null ? '—' : `${metric(data.totals.payoutRatio)}×`}</b></span>
        </div>
      </section>
      <div className="mb-3 mt-8 flex flex-wrap items-end justify-between gap-2">
        <div><div className="flex items-center gap-2"><BarChart3 size={15} className="text-primary"/><h2 className="text-[13px] font-semibold tracking-wide">STRATEGY BREAKDOWN</h2></div><p className="mt-1 text-[10px] text-muted-foreground">Drag cards to reorder · order lasts for this preview session.</p></div><span className="mono text-[10px] text-muted-foreground">{orderedStrategies.length} strategies</span>
      </div>
      {data.pausedMagicNumbers.length > 0 && <details open={pausedStrategiesOpen} onToggle={(event) => setPausedStrategiesOpen(event.currentTarget.open)} className="panel mb-4 overflow-hidden rounded-xl" aria-label="Paused strategies" data-testid="panel-paused-strategies">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5" data-testid="toggle-paused-strategies"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold">Paused strategies</h3><span className="mono rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">{data.pausedMagicNumbers.length}</span></div><p className="mt-1 text-[11px] text-muted-foreground">Re-enable magic numbers to accept future MT5 uploads.</p></div><ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${pausedStrategiesOpen ? 'rotate-180' : ''}`}/></summary>
        <div className="border-t border-border/70 p-4 sm:px-5"><p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">New MT5 trades for these magic numbers are ignored. Re-enabling starts collecting new trades again; deleted history will not return.</p><div className="flex flex-wrap gap-2">{data.pausedMagicNumbers.map((magicNumber) => <div key={magicNumber} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 py-1 pl-2.5 pr-1"><span className="mono text-[11px] font-semibold">Magic #{magicNumber}</span><button type="button" onClick={() => setNotice(`Re-enable for magic number ${magicNumber} is disabled in the local sample preview.`)} className="inline-flex h-7 items-center rounded-md bg-primary/15 px-2 text-[10px] font-semibold text-primary transition hover:bg-primary/25" aria-label={`Re-enable monitoring for magic number ${magicNumber}`} data-testid={`button-resume-strategy-${magicNumber}`}>Re-enable</button></div>)}</div></div>
      </details>}
      {hasData && <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {orderedStrategies.map((strategy, index) => <StrategyPanel key={strategy.magicNumber} strategy={strategy} light={light} orderIndex={index} strategyCount={orderedStrategies.length} onMove={(direction) => { const target = orderedStrategies[index + direction]; if (target) reorderStrategy(strategy.magicNumber, target.magicNumber); }} onReorder={reorderStrategy} onDragStart={(magicNumber) => { setDraggedMagicNumber(magicNumber); setDropTargetMagicNumber(null); }} onDragOver={setDropTargetMagicNumber} onDragEnd={() => { setDraggedMagicNumber(null); setDropTargetMagicNumber(null); }} isDragging={draggedMagicNumber === strategy.magicNumber} isDropTarget={dropTargetMagicNumber === strategy.magicNumber && draggedMagicNumber !== strategy.magicNumber} onPause={(selected) => setNotice(`Pause for magic number ${selected.magicNumber} is disabled in the local sample preview.`)}/>)}
      </div>}
      <p className="mt-4 text-center text-[10px] text-muted-foreground">Sample metrics are illustrative. Net profit includes realized profit, commission and swap. Sharpe is not annualized.</p>
      <details id="webhook-setup" className="panel mt-7 overflow-hidden rounded-xl" data-testid="webhook-setup">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3.5"><span><span className="text-[12px] font-semibold">MT5 webhook setup</span><span className="ml-2 text-[10px] text-muted-foreground">Reference only · this preview sends no requests</span></span><span className="inline-flex items-center gap-2"><span className="mono rounded-md border border-border bg-background/80 px-2 py-1 text-[10px] text-primary">POST /api/trades</span><span aria-hidden="true" className="text-muted-foreground">⌄</span></span></summary>
        <div className="grid gap-4 border-t border-border/70 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Webhook URL (example)</p><div className="mt-1.5 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-md border border-border bg-background/80 px-2.5 py-2 text-[11px] text-foreground">{webhookUrl}</code><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(webhookUrl); setUrlCopied(true); setCopyError(false); window.setTimeout(() => setUrlCopied(false), 1800); } catch { setCopyError(true); setUrlCopied(false); } }} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background/80 px-3 text-[11px] text-muted-foreground hover:text-foreground" aria-label="Copy webhook URL" data-testid="button-copy-webhook-url">{urlCopied ? <Check size={13} /> : <Download size={13} />}{urlCopied ? 'Copied' : copyError ? 'Copy failed' : 'Copy URL'}</button></div><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Reference details from the original dashboard. No request is issued from this local sample view.</p></div>
          <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Example request body</p><pre className="mono mt-1.5 overflow-x-auto rounded-md border border-border bg-background/80 p-3 text-[10px] leading-relaxed text-foreground"><code>{`{
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
}`}</code></pre><p className="mt-1.5 text-[10px] text-muted-foreground">Net profit is profit + commission + swap. ticket is optional; ticket deduplication is scoped by account_id.</p></div>
        </div>
      </details>
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 text-[10px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> MT5 analytics workspace · local sample</span><span>Precision over prediction.</span></footer>
    </div>
  </main>;
}