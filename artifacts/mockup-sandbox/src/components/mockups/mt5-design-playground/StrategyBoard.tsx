import { useMemo, useState, type ReactNode } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Check,
  ChevronDown, ChevronUp, Clock3, Copy, Download, GripVertical, Moon,
  Pause, Play, Printer, RefreshCw, ShieldAlert, Sun, Trash2, WalletCards, X,
} from 'lucide-react';
import { fixture, money, percent, type StrategyPerformance } from './_fixture';
import './strategy-board.css';

type StrategyUnit = StrategyPerformance & { paused: boolean };

const intervals = [
  { label: '5 minutes', value: 300_000 },
  { label: '15 minutes', value: 900_000 },
  { label: '1 hour', value: 3_600_000 },
  { label: '24 hours', value: 86_400_000 },
];

const metricNumber = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(2);
const profitFactor = (value: number | null, item?: Pick<StrategyPerformance, 'losses' | 'netProfit'>) =>
  value != null && Number.isFinite(value) ? value.toFixed(2)
    : item && item.losses === 0 && item.netProfit > 0 ? '∞' : '—';
const dateShort = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function EquityLine({ strategy, large = false }: { strategy: StrategyPerformance; large?: boolean }) {
  const points = useMemo(() => [...strategy.equity].sort(
    (a, b) => new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime(),
  ), [strategy.equity]);
  if (!points.length) return <div className="sb-empty-equity">No closed-trade equity points.</div>;

  const width = 560;
  const height = large ? 162 : 50;
  const padX = large ? 8 : 2;
  const padY = large ? 10 : 3;
  const values = points.map((point) => point.cumulativeProfit);
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const range = high - low || 1;
  const coords = points.map((point, index) => ({
    x: padX + (index / Math.max(1, points.length - 1)) * (width - padX * 2),
    y: padY + ((high - point.cumulativeProfit) / range) * (height - padY * 2),
  }));
  const line = coords.map((point) => `${point.x},${point.y}`).join(' ');
  const color = strategy.netProfit >= 0 ? 'var(--sb-chart-profit)' : 'var(--sb-chart-loss)';
  const zeroY = padY + ((high - 0) / range) * (height - padY * 2);
  const firstDate = points[0].closeTime;
  const lastDate = points[points.length - 1].closeTime;

  return <div className={`sb-equity ${large ? 'sb-equity-large' : ''}`}>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img"
      aria-label={`Magic number ${strategy.magicNumber} cumulative realized net profit over ${points.length} closed trades`}>
      {large && <line x1="0" x2={width} y1={zeroY} y2={zeroY} stroke="currentColor" strokeDasharray="4 6" opacity=".24" />}
      <polygon points={`${coords[0].x},${height} ${line} ${coords[coords.length - 1].x},${height}`} fill={color} opacity={large ? '.10' : '.09'} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={large ? '2.8' : '2'} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {large && coords.map((point, index) => <circle key={points[index].closeTime} cx={point.x} cy={point.y} r="2.6" fill={color} />)}
    </svg>
    {large && <div className="sb-chart-foot"><span>{dateShort(firstDate)}</span><span>{points.length} closes</span><span>{dateShort(lastDate)}</span></div>}
  </div>;
}

function TinyStat({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className={`sb-tiny-stat ${emphasis ? 'sb-emphasis' : ''}`}>
    <span>{label}</span><strong>{value}</strong>
  </div>;
}

function Metric({ label, value, detail, icon, accent = false }: {
  label: string; value: string; detail: string; icon: ReactNode; accent?: boolean;
}) {
  return <div className={`sb-account-metric ${accent ? 'sb-account-accent' : ''}`}>
    <div className="sb-metric-top"><span>{label}</span><i>{icon}</i></div>
    <strong>{value}</strong><small>{detail}</small>
  </div>;
}

function exportEquity(strategy: StrategyPerformance) {
  const rows = [
    'close_time,trade_net_profit,cumulative_net_profit',
    ...strategy.equity.map((point) => [point.closeTime, point.netProfit, point.cumulativeProfit].join(',')),
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `magic-${strategy.magicNumber}-net-profit-equity.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function StrategyTile({ strategy, index, count, onMove, onDropReorder, onPause, onNotice }: {
  strategy: StrategyUnit;
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
  onDropReorder: (source: number, target: number) => void;
  onPause: () => void;
  onNotice: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const positive = strategy.netProfit >= 0;
  const detailsId = `board-detail-${strategy.magicNumber}`;
  const avg = strategy.tradeCount ? strategy.netProfit / strategy.tradeCount : 0;
  const detailRows = [
    ['Max drawdown', money(strategy.maxDrawdown)],
    ['Avg net / trade', money(avg)],
    ['Sharpe ratio', metricNumber(strategy.sharpeRatio)],
    ['Payout ratio', strategy.payoutRatio == null ? '—' : `${metricNumber(strategy.payoutRatio)}×`],
    ['Wins / losses', `${strategy.wins} / ${strategy.losses}`],
    ['Breakeven', String(strategy.breakeven)],
  ];
  return <article
    className={`sb-unit ${strategy.paused ? 'sb-unit-paused' : ''}`}
    data-testid={`strategy-${strategy.magicNumber}`}
    draggable
    onDragStart={(event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(strategy.magicNumber));
    }}
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => {
      event.preventDefault();
      const source = Number(event.dataTransfer.getData('text/plain'));
      if (Number.isSafeInteger(source) && source !== strategy.magicNumber) onDropReorder(source, strategy.magicNumber);
    }}
  >
    <header className="sb-unit-head">
      <span className="sb-unit-index">{String(index + 1).padStart(2, '0')}</span>
      <div className="sb-unit-identity">
        <div className="sb-id-line"><span className="sb-overline">EXPERT ADVISOR</span><span className={`sb-status ${strategy.paused ? 'is-paused' : ''}`}><i />{strategy.paused ? 'Paused' : 'Active'}</span></div>
        <h3>Magic <b>{strategy.magicNumber}</b></h3>
        <div className="sb-symbols" aria-label={`Traded symbols for magic number ${strategy.magicNumber}`}>
          {strategy.symbols.length ? strategy.symbols.map((symbol) => <span key={symbol}>{symbol}</span>) : <span className="sb-no-symbols">No ticker data</span>}
        </div>
      </div>
      <div className="sb-unit-tools">
        <span className="sb-drag-handle" title="Drag to reorder" aria-hidden="true"><GripVertical size={15} /></span>
        <div className="sb-reorder">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move magic number ${strategy.magicNumber} up`} data-testid={`button-move-up-${strategy.magicNumber}`}><ChevronUp size={13} /></button>
          <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move magic number ${strategy.magicNumber} down`} data-testid={`button-move-down-${strategy.magicNumber}`}><ChevronDown size={13} /></button>
        </div>
      </div>
    </header>

    <div className="sb-main-signal">
      <div className="sb-net-copy">
        <span className="sb-overline">REALIZED NET</span>
        <strong className={positive ? 'is-positive' : 'is-negative'}>{money(strategy.netProfit)}</strong>
        <span className="sb-net-caption">profit + commission + swap</span>
      </div>
      <div className="sb-spark" aria-label="Cumulative realized net profit mini chart"><EquityLine strategy={strategy} /></div>
      <div className="sb-close-count"><strong>{strategy.tradeCount}</strong><span>closed<br />trades</span></div>
    </div>

    <div className="sb-stat-rail">
      <TinyStat label="Win rate" value={percent(strategy.winRate)} />
      <TinyStat label="Profit factor" value={profitFactor(strategy.profitFactor, strategy)} />
      <TinyStat label="Drawdown" value={money(strategy.maxDrawdown)} />
      <TinyStat label="Avg / trade" value={money(avg)} emphasis />
    </div>

    <button className="sb-expand" type="button" aria-expanded={expanded} aria-controls={detailsId}
      onClick={() => setExpanded((value) => !value)} data-testid={`button-toggle-details-${strategy.magicNumber}`}>
      <span>{expanded ? 'Close performance record' : 'Open performance record'}</span><ArrowRight size={14} className={expanded ? 'sb-arrow-open' : ''} />
    </button>
    <div id={detailsId} hidden={!expanded} className="sb-detail">
      {expanded && <>
        <div className="sb-detail-grid">
          {detailRows.map(([label, value]) => <div className="sb-detail-item" key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
        <div className="sb-equity-section">
          <div className="sb-equity-title"><div><span className="sb-overline">CLOSE-TIME SERIES</span><h4>Cumulative net profit</h4></div><span className="sb-currency">USD · realized</span></div>
          <EquityLine strategy={strategy} large />
        </div>
        <div className="sb-detail-actions">
          <button type="button" onClick={() => exportEquity(strategy)} data-testid={`export-csv-${strategy.magicNumber}`}><Download size={13} /> Export equity CSV</button>
          <button type="button" className="sb-danger-action" onClick={() => onNotice(`Delete history for magic ${strategy.magicNumber} is disabled in this local sample preview.`)}><Trash2 size={13} /> Delete history</button>
        </div>
      </>}
    </div>
    <footer className="sb-unit-foot">
      <button type="button" onClick={onPause} className="sb-pause-button" data-testid={`button-pause-${strategy.magicNumber}`}>
        {strategy.paused ? <Play size={13} /> : <Pause size={13} />}{strategy.paused ? 'Re-enable' : 'Pause monitoring'}
      </button>
      <span className="sb-breakeven">{strategy.breakeven} breakeven</span>
    </footer>
  </article>;
}

export function StrategyBoard() {
  const [units, setUnits] = useState<StrategyUnit[]>(() => fixture.strategies.map((strategy) => ({ ...strategy, paused: false })));
  const [pausedNumbers, setPausedNumbers] = useState<number[]>(fixture.pausedMagicNumbers);
  const [notice, setNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [interval, setInterval] = useState(intervals[0].value);
  const [light, setLight] = useState(false);
  const [pausedOpen, setPausedOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const orderedUnits = useMemo(() => units, [units]);
  const activeCount = orderedUnits.filter((unit) => !unit.paused).length
    + fixture.pausedMagicNumbers.length - pausedNumbers.length;
  const pausedCount = pausedNumbers.length + orderedUnits.filter((unit) => unit.paused).length;
  const latest = new Date(fixture.latestTradeAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  const moveUnit = (sourceIndex: number, direction: -1 | 1) => {
    const target = sourceIndex + direction;
    if (target < 0 || target >= units.length) return;
    setUnits((current) => {
      const next = [...current];
      [next[sourceIndex], next[target]] = [next[target], next[sourceIndex]];
      return next;
    });
  };
  const reorderUnits = (sourceMagic: number, targetMagic: number) => {
    setUnits((current) => {
      const next = [...current];
      const sourceIndex = next.findIndex((unit) => unit.magicNumber === sourceMagic);
      const targetIndex = next.findIndex((unit) => unit.magicNumber === targetMagic);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };
  const toggleUnit = (magicNumber: number) => {
    setUnits((current) => current.map((unit) => unit.magicNumber === magicNumber ? { ...unit, paused: !unit.paused } : unit));
    setNotice(`Monitoring state changed locally for magic ${magicNumber}. Historical performance remains unchanged.`);
  };
  const reenablePaused = (magicNumber: number) => {
    setPausedNumbers((current) => current.filter((value) => value !== magicNumber));
    setNotice(`Magic ${magicNumber} marked active in this local preview. No MT5 uploads were sent.`);
  };
  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText('POST /api/trades');
      setCopied(true);
      setNotice('Webhook reference copied. This preview did not send a request.');
    } catch {
      setCopied(false);
      setNotice('Clipboard access is unavailable here. Webhook reference: POST /api/trades.');
    }
  };

  return <main id="sb-current-root" className={`strategy-board ${light ? 'sb-light' : ''}`} data-testid="strategy-board">
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap');
      .strategy-board{--ink:#11191a;--surface:#192222;--surface2:#202b29;--line:#34413c;--text:#e8eee3;--muted:#9ba89d;--acid:#b8ee74;--acid-dark:#25351e;--red:#e58d7e;--amber:#efbd67;min-height:100dvh;background:radial-gradient(ellipse at 80% -20%,#26392b 0,transparent 40%),var(--ink);color:var(--text);font-family:'DM Sans',sans-serif;padding:22px clamp(14px,3.8vw,56px) 52px;position:relative;overflow:hidden}
      .strategy-board:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.13;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.17'/%3E%3C/svg%3E");z-index:0}
      .strategy-board *{box-sizing:border-box}.sb-wrap{max-width:1450px;margin:0 auto;position:relative;z-index:1}.strategy-board button{font:inherit;color:inherit;cursor:pointer}.strategy-board button:focus-visible,.strategy-board summary:focus-visible{outline:2px solid var(--acid);outline-offset:3px}.strategy-board button:disabled{opacity:.28;cursor:not-allowed}.strategy-board .mono,.sb-unit h3 b,.sb-account-metric strong,.sb-tiny-stat strong,.sb-detail-item strong,.sb-paused-number{font-family:'DM Mono',monospace;font-variant-numeric:tabular-nums}
      .sb-topline{display:flex;justify-content:space-between;gap:15px;align-items:center;padding-bottom:19px;border-bottom:1px solid var(--line)}.sb-brand{display:flex;gap:12px;align-items:center}.sb-mark{width:39px;height:39px;display:grid;place-items:center;border:1px solid #52624b;color:var(--acid);background:#1f2a21;position:relative}.sb-mark:after{content:"";position:absolute;width:6px;height:6px;border-radius:50%;background:var(--acid);right:-3px;top:-3px;box-shadow:0 0 0 3px var(--ink)}.sb-brand-copy p{margin:0 0 3px;color:var(--acid);font-size:9px;font-weight:700;letter-spacing:.18em}.sb-brand-copy h1{font:700 clamp(20px,2.5vw,29px)/1.1 Manrope,sans-serif;letter-spacing:-.05em;margin:0}.sb-brand-copy small{font-size:10px;color:var(--muted);margin-left:8px;letter-spacing:.1em}
      .sb-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.sb-btn{height:35px;padding:0 11px;border:1px solid var(--line);background:#192221;display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:600;transition:transform .18s,background .18s,border-color .18s}.sb-btn:hover{background:#28332f;border-color:#73836e;transform:translateY(-1px)}.sb-btn-primary{color:var(--acid)!important;border-color:#576e43;background:#253322}.sb-btn-danger{border-color:#69413b;color:var(--red)!important;background:#2b201e}.sb-icon-btn{width:35px;padding:0;justify-content:center}.sb-settings{position:relative}.sb-menu{position:absolute;right:0;top:43px;width:230px;padding:14px;background:#1d2825;border:1px solid #4a5b50;z-index:10;box-shadow:0 18px 45px #0008}.sb-menu-title{font-size:12px;font-weight:700}.sb-menu p{color:var(--muted);font-size:10px;line-height:1.5;margin:5px 0 12px}.sb-switch-row{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--line)}.sb-switch{height:19px;width:34px;border:0;background:#49564f;padding:2px;text-align:left}.sb-switch i{display:block;width:15px;height:15px;background:#dce5d9;transition:transform .18s}.sb-switch[aria-checked="true"]{background:#648849}.sb-switch[aria-checked="true"] i{transform:translateX(15px)}.sb-intervals{display:grid;gap:3px;padding-top:9px}.sb-intervals button{border:0;background:none;text-align:left;padding:7px;font-size:11px;display:flex;justify-content:space-between}.sb-intervals button:hover{background:#2b3833}
      .sb-sample-ribbon{margin:15px 0 22px;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #526544;background:#202a20;padding:9px 12px}.sb-sample-label{color:var(--acid);font-size:9px;font-weight:800;letter-spacing:.16em}.sb-sample-ribbon p{font-size:10px;color:#c3cec0;margin:0}.sb-live-state{display:flex;gap:8px;align-items:center;font:10px 'DM Mono',monospace;white-space:nowrap;color:#c4d3bf}.sb-live-state b{color:var(--acid);font-weight:500}.sb-live-state i{width:7px;height:7px;border-radius:50%;background:var(--acid)}
      .sb-hero{display:grid;grid-template-columns:1fr auto;align-items:end;gap:20px;margin:24px 0 19px}.sb-hero h2{font:700 clamp(24px,3vw,37px)/1.05 Manrope,sans-serif;letter-spacing:-.055em;margin:5px 0 7px}.sb-kicker{font:10px 'DM Mono',monospace;letter-spacing:.15em;color:var(--muted);text-transform:uppercase}.sb-hero p{margin:0;color:var(--muted);font-size:12px}.sb-last-sync{text-align:right;color:var(--muted);font:10px 'DM Mono',monospace}.sb-last-sync strong{display:block;color:var(--text);font-size:12px;font-weight:500;margin-top:4px}
      .sb-notice{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid #627a4c;background:#253124;color:#d8e9cb;font-size:11px;margin:0 0 17px}.sb-notice button{border:0;background:transparent;display:grid;place-items:center;padding:3px;color:inherit}
      .sb-overview{margin-top:13px}.sb-section-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 9px}.sb-section-title{display:flex;align-items:center;gap:8px}.sb-section-title i{font-style:normal;color:var(--acid);font-size:10px}.sb-section-title h3{font-size:10px;letter-spacing:.14em;margin:0;font-weight:700}.sb-section-note{font-size:10px;color:var(--muted)}.sb-account-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.sb-account-metric{padding:11px 11px 10px;background:linear-gradient(140deg,#1c2724,#18211f);border:1px solid #33413b;min-width:0;min-height:88px}.sb-metric-top{display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em}.sb-metric-top i{color:#8da17f;display:grid}.sb-account-metric strong{font-size:17px;display:block;margin-top:10px;letter-spacing:-.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sb-account-accent strong{color:var(--acid)}.sb-account-metric small{font-size:9px;color:#839087;display:block;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sb-method{display:flex;flex-wrap:wrap;gap:9px 19px;padding:9px 11px;border:1px solid #2c3933;border-top:0;background:#161f1d;color:var(--muted);font-size:9px}.sb-method strong{color:#cfdbca;font-family:'DM Mono',monospace;font-weight:400}
      .sb-board-heading{margin:27px 0 11px;display:flex;justify-content:space-between;align-items:end;gap:12px}.sb-board-heading h2{font:700 17px Manrope,sans-serif;letter-spacing:-.03em;margin:0}.sb-board-heading p{font-size:10px;color:var(--muted);margin:4px 0 0}.sb-sort-chip{font:10px 'DM Mono',monospace;color:var(--acid);border:1px solid #4c6141;padding:6px 9px;white-space:nowrap}
      .sb-units{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:start}.sb-unit{background:linear-gradient(145deg,#202b28,#18211f 68%);border:1px solid #3b4941;position:relative;min-width:0;transition:border-color .18s,transform .18s}.sb-unit:hover{border-color:#708067;transform:translateY(-2px)}.sb-unit:before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:var(--acid);opacity:.8}.sb-unit-paused:before{background:var(--amber)}.sb-unit-head{min-height:79px;padding:13px 13px 10px 16px;display:flex;gap:11px;align-items:flex-start;border-bottom:1px solid #303d37}.sb-unit-index{font:10px 'DM Mono',monospace;color:#748278;padding-top:3px}.sb-unit-identity{min-width:0;flex:1}.sb-id-line{display:flex;align-items:center;gap:8px}.sb-overline{font:8px 'DM Mono',monospace;letter-spacing:.13em;color:#92a095}.sb-status{display:inline-flex;align-items:center;gap:5px;color:var(--acid);font:8px 'DM Mono',monospace;text-transform:uppercase;letter-spacing:.06em}.sb-status i{width:5px;height:5px;border-radius:50%;background:currentColor}.sb-status.is-paused{color:var(--amber)}.sb-unit h3{font:600 17px Manrope,sans-serif;letter-spacing:-.04em;margin:4px 0 5px}.sb-unit h3 b{color:var(--acid);font-weight:500}.sb-symbols{display:flex;gap:4px;flex-wrap:wrap}.sb-symbols span{padding:2px 5px;border:1px solid #45534b;color:#bdcbbc;font:8px 'DM Mono',monospace;letter-spacing:.04em}.sb-symbols .sb-no-symbols{color:var(--muted)}.sb-unit-tools{display:flex;gap:4px;align-items:center;color:#8c9a90}.sb-drag-handle{display:grid;place-items:center;cursor:grab}.sb-reorder{display:grid}.sb-reorder button{height:14px;width:20px;padding:0;display:grid;place-items:center;border:1px solid #3d4942;background:#222d29}.sb-reorder button+button{border-top:0}
      .sb-main-signal{display:grid;grid-template-columns:minmax(0,1fr) minmax(72px,.8fr) auto;gap:8px;align-items:center;padding:13px 14px 12px 16px}.sb-net-copy{min-width:0}.sb-net-copy>strong{display:block;font:500 clamp(18px,1.55vw,24px) 'DM Mono',monospace;letter-spacing:-.075em;margin:4px 0 2px;white-space:nowrap}.sb-net-copy>strong.is-positive{color:var(--acid)}.sb-net-copy>strong.is-negative{color:var(--red)}.sb-net-caption{font-size:8px;color:#859288;white-space:nowrap}.sb-spark{height:43px;min-width:0}.sb-equity{width:100%;height:100%;color:#8a998d}.sb-equity svg{width:100%;height:100%;display:block;overflow:visible}.sb-close-count{border-left:1px solid #38443d;padding-left:10px;display:flex;gap:5px;align-items:center}.sb-close-count strong{font:500 15px 'DM Mono',monospace}.sb-close-count span{font-size:8px;line-height:1.2;color:var(--muted)}
      .sb-stat-rail{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid #303b35;border-bottom:1px solid #303b35;background:#151e1c}.sb-tiny-stat{padding:8px 8px 9px;border-right:1px solid #2a3630;min-width:0}.sb-tiny-stat:last-child{border:0}.sb-tiny-stat span{display:block;color:#8e9c91;font-size:8px;white-space:nowrap}.sb-tiny-stat strong{display:block;font-size:11px;font-weight:400;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sb-tiny-stat.sb-emphasis strong{color:var(--acid)}
      .sb-expand{width:100%;display:flex;align-items:center;justify-content:space-between;border:0;border-bottom:1px solid #303b35;background:transparent;text-align:left;padding:9px 14px 9px 16px;color:#bfccb9;font-size:10px}.sb-expand:hover{background:#25312c;color:var(--acid)}.sb-expand svg{transition:transform .18s}.sb-expand .sb-arrow-open{transform:rotate(90deg);color:var(--acid)}
      .sb-detail{padding:12px 14px 14px 16px}.sb-detail-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.sb-detail-item{background:#151e1c;padding:8px;min-width:0}.sb-detail-item span{display:block;color:#91a095;font-size:8px}.sb-detail-item strong{font-size:10px;display:block;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:400}.sb-equity-section{margin-top:14px}.sb-equity-title{display:flex;align-items:end;justify-content:space-between;gap:8px}.sb-equity-title h4{font:600 12px Manrope,sans-serif;margin:4px 0}.sb-currency{font:8px 'DM Mono',monospace;color:var(--muted)}.sb-equity-large{height:145px;margin-top:8px;padding:8px;background:#151e1c;border:1px solid #2e3a34}.sb-chart-foot{display:flex;justify-content:space-between;color:#839187;font:8px 'DM Mono',monospace}.sb-equity-large svg{height:calc(100% - 15px)}.sb-equity-large svg circle{vector-effect:non-scaling-stroke}.sb-empty-equity{font-size:10px;color:var(--muted);padding:15px}.sb-detail-actions{display:flex;justify-content:space-between;gap:8px;margin-top:10px}.sb-detail-actions button{display:inline-flex;align-items:center;gap:5px;background:#222d29;border:1px solid #435149;padding:7px 8px;font-size:9px}.sb-detail-actions button:hover{border-color:#83937b}.sb-detail-actions .sb-danger-action{color:var(--red);border-color:#64433d}
      .sb-unit-foot{display:flex;justify-content:space-between;align-items:center;padding:9px 13px 10px 16px}.sb-pause-button{display:inline-flex;gap:6px;align-items:center;background:transparent;border:0;padding:0;color:#c0cbbb;font-size:9px}.sb-pause-button:hover{color:var(--acid)}.sb-unit-paused .sb-pause-button{color:var(--amber)}.sb-breakeven{font-size:8px;color:#7f8d83}
      .sb-paused{border:1px solid #35413b;background:#192220;margin-top:17px}.sb-paused summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:11px 13px}.sb-paused summary::-webkit-details-marker{display:none}.sb-paused-title{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700}.sb-paused-title b{font:10px 'DM Mono',monospace;color:var(--amber);border:1px solid #615239;padding:2px 6px}.sb-paused summary p{margin:4px 0 0;color:var(--muted);font-size:9px}.sb-paused-content{padding:10px 13px;border-top:1px solid #34413b;display:flex;flex-wrap:wrap;gap:7px}.sb-paused-item{display:flex;align-items:center;gap:8px;padding:5px 6px 5px 9px;background:#222b27;border:1px solid #485249}.sb-paused-number{font-size:10px}.sb-paused-item button{border:1px solid #61794a;background:#293a25;color:var(--acid);font-size:9px;padding:5px 7px}.sb-paused-item button:hover{background:#354d2d}
      .sb-footnote{margin:16px 0 0;color:#839087;font-size:9px;line-height:1.65}.sb-webhook{margin-top:22px;border:1px solid #35423b;background:#192220}.sb-webhook summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px}.sb-webhook summary::-webkit-details-marker{display:none}.sb-webhook-title{font-size:11px;font-weight:700}.sb-webhook-title small{display:block;font-size:9px;font-weight:400;color:var(--muted);margin-top:3px}.sb-endpoint{font:10px 'DM Mono',monospace;color:var(--acid);border:1px solid #4d6344;padding:6px 8px;white-space:nowrap}.sb-webhook-content{border-top:1px solid #35423b;padding:13px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center}.sb-webhook-content p{font-size:10px;color:#b0bcb1;margin:0;line-height:1.55}.sb-webhook-content code{font:10px 'DM Mono',monospace;color:var(--acid)}.sb-webhook-content button{display:flex;gap:6px;align-items:center;background:#263529;border:1px solid #587046;color:var(--acid);padding:8px 10px;font-size:10px}
      .sb-light{--ink:#edf0e5;--surface:#fff;--surface2:#f2f3e9;--line:#ccd3c4;--text:#202923;--muted:#68776a;--acid:#527b31;--acid-dark:#e4ecd9;--red:#b8584f;--amber:#9c712d;background:radial-gradient(ellipse at 80% -20%,#dfe9d2 0,transparent 40%),var(--ink)}.sb-light .sb-mark,.sb-light .sb-btn,.sb-light .sb-account-metric,.sb-light .sb-method,.sb-light .sb-unit,.sb-light .sb-stat-rail,.sb-light .sb-tiny-stat,.sb-light .sb-detail-item,.sb-light .sb-equity-large,.sb-light .sb-paused,.sb-light .sb-paused-item,.sb-light .sb-webhook{background:#f8f8f0}.sb-light .sb-sample-ribbon,.sb-light .sb-notice{background:#e6efdc}.sb-light .sb-menu{background:#f8f8f0;color:var(--text)}.sb-light .sb-switch{color:var(--text)}.sb-light .sb-expand:hover{background:#e7ecdf}.sb-light .sb-detail-actions button{background:#e8ece2}
      @media(max-width:1050px){.sb-account-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.sb-units{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:680px){.strategy-board{padding:14px 12px 32px}.sb-topline{align-items:flex-start;flex-direction:column}.sb-actions{width:100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}.sb-btn{justify-content:center;padding:0 6px;font-size:10px}.sb-btn-text{display:none}.sb-settings{grid-column:auto}.sb-menu{left:0;right:auto}.sb-sample-ribbon{align-items:flex-start;flex-direction:column}.sb-live-state{white-space:normal}.sb-hero{grid-template-columns:1fr;margin-top:20px}.sb-last-sync{text-align:left}.sb-account-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sb-account-metric{min-height:78px;padding:9px}.sb-account-metric strong{font-size:16px;margin-top:7px}.sb-method{gap:6px 12px}.sb-board-heading{align-items:flex-start}.sb-board-heading h2{font-size:15px}.sb-units{grid-template-columns:1fr;gap:9px}.sb-main-signal{grid-template-columns:minmax(0,1fr) minmax(88px,.75fr) auto}.sb-net-copy>strong{font-size:23px}.sb-unit-head{min-height:76px}.sb-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sb-webhook summary{align-items:flex-start}.sb-webhook-title small{max-width:220px;line-height:1.4}.sb-endpoint{font-size:9px}.sb-webhook-content{grid-template-columns:1fr}.sb-webhook-content button{justify-content:center}.sb-section-heading{align-items:flex-start}.sb-section-note{max-width:45%;text-align:right}.sb-paused summary p{max-width:270px}}
      @media(prefers-reduced-motion:reduce){.strategy-board *{transition:none!important;scroll-behavior:auto!important}}
      @media print{.strategy-board{background:#fff;color:#18231d;padding:0}.sb-actions,.sb-unit-tools,.sb-pause-button,.sb-detail-actions,.sb-expand,.sb-paused,.sb-webhook{display:none!important}.sb-unit,.sb-account-metric{break-inside:avoid}}
    `}</style>
    <div className="sb-wrap">
      <header className="sb-topline">
        <div className="sb-brand">
          <div className="sb-mark"><Activity size={19} /></div>
          <div className="sb-brand-copy"><p>MT5 / PRIVATE ANALYTICS</p><h1>Strategy board <small>TERMINAL 05</small></h1></div>
        </div>
        <div className="sb-actions">
          <button className="sb-btn sb-btn-primary" type="button" onClick={() => setNotice('Local sample fixture is shown; no refresh request was sent.')} data-testid="button-refresh"><RefreshCw size={13} /><span className="sb-btn-text">Refresh</span></button>
          <div className="sb-settings">
            <button className="sb-btn sb-icon-btn" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Open refresh settings" aria-expanded={menuOpen} data-testid="button-dashboard-settings"><ChevronDown size={15} /></button>
            {menuOpen && <div className="sb-menu">
              <div className="sb-switch-row"><div><div className="sb-menu-title">Auto-refresh</div><p>Local preview only</p></div><button type="button" className="sb-switch" role="switch" aria-checked={autoRefresh} onClick={() => setAutoRefresh((value) => !value)} data-testid="toggle-auto-refresh"><i /></button></div>
              <div className="sb-intervals"><span className="sb-overline">INTERVAL</span>{intervals.map((option) => <button type="button" key={option.value} onClick={() => { setInterval(option.value); setMenuOpen(false); }} aria-pressed={interval === option.value}>{option.label}{interval === option.value && <Check size={12} />}</button>)}</div>
              <p>No network polling is performed by this preview.</p>
            </div>}
          </div>
          <button className="sb-btn sb-btn-danger" type="button" onClick={() => setNotice('Clear all trades is disabled in this local sample preview.')} data-testid="button-clear-all-trades"><Trash2 size={13} /><span className="sb-btn-text">Clear trades</span></button>
          <button className="sb-btn sb-icon-btn" type="button" onClick={() => window.print()} aria-label="Export dashboard as PDF" data-testid="button-export-pdf"><Printer size={14} /></button>
          <button className="sb-btn sb-icon-btn" type="button" onClick={() => setLight((value) => !value)} aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'} data-testid="button-toggle-theme">{light ? <Moon size={14} /> : <Sun size={14} />}</button>
        </div>
      </header>

      <div className="sb-sample-ribbon" role="note">
        <p><span className="sb-sample-label">LOCAL SAMPLE</span> &nbsp; Illustrative metrics only · no backend or account connection</p>
        <div className="sb-live-state"><i /><b>{activeCount} ACTIVE</b><span>/</span><span>{pausedCount} PAUSED</span><span>/</span><span>{fixture.totals.tradeCount} closes</span></div>
      </div>

      <section className="sb-hero">
        <div><div className="sb-kicker">Account overview / realized performance</div><h2>Every magic number.<br />A clear read.</h2><p>Exact closed-trade results, grouped by Expert Advisor identifier.</p></div>
        <div className="sb-last-sync">LATEST SAMPLE SYNC<strong><Clock3 size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 5 }} />{latest}</strong></div>
      </section>

      {notice && <div className="sb-notice" role="status" data-testid="status-board-notice"><span>{notice}</span><button type="button" aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={14} /></button></div>}

      <section className="sb-overview" aria-label="Account-wide performance summary">
        <div className="sb-section-heading"><div className="sb-section-title"><i>01</i><h3>ACCOUNT PERFORMANCE</h3></div><span className="sb-section-note">All strategies · all closed trades</span></div>
        <div className="sb-account-grid">
          <Metric label="Net profit" value={money(fixture.totals.netProfit)} detail="realized + costs" accent icon={<ArrowUpRight size={13} />} />
          <Metric label="Avg net / trade" value={money(fixture.totals.tradeCount ? fixture.totals.netProfit / fixture.totals.tradeCount : 0)} detail="net ÷ closed trades" icon={<Activity size={13} />} />
          <Metric label="Profit factor" value={profitFactor(fixture.totals.profitFactor, fixture.totals)} detail="gross wins ÷ losses" icon={<BarChart3 size={13} />} />
          <Metric label="Win rate" value={percent(fixture.totals.winRate)} detail={`${fixture.totals.wins} wins · ${fixture.totals.losses} losses`} icon={<ArrowUpRight size={13} />} />
          <Metric label="Max drawdown" value={money(fixture.totals.maxDrawdown)} detail="peak-to-trough" icon={<ArrowDownRight size={13} />} />
          <Metric label="Strategies" value={String(fixture.totals.magicNumberCount)} detail="unique magic numbers" icon={<WalletCards size={13} />} />
          <Metric label="Closed trades" value={fixture.totals.tradeCount.toLocaleString()} detail={`${fixture.totals.wins}W · ${fixture.totals.losses}L`} icon={<Clock3 size={13} />} />
        </div>
        <div className="sb-method"><span>Net profit <strong>= realized profit + commission + swap</strong></span><span>Per-trade Sharpe <strong>not annualized · {metricNumber(fixture.totals.sharpeRatio)}</strong></span><span>Payout ratio <strong>{fixture.totals.payoutRatio == null ? '—' : `${metricNumber(fixture.totals.payoutRatio)}×`}</strong></span></div>
      </section>

      <div className="sb-board-heading"><div><h2>Strategy units</h2><p>One operating record per magic number · use arrows to reorder</p></div><span className="sb-sort-chip">{orderedUnits.length} UNITS / DRAG TO MOVE</span></div>
      {orderedUnits.length ? <section className="sb-units" aria-label="Strategy performance by magic number">
        {orderedUnits.map((strategy, index) => <StrategyTile key={strategy.magicNumber} strategy={strategy} index={index} count={orderedUnits.length}
          onMove={(direction) => moveUnit(index, direction)}
          onDropReorder={reorderUnits}
          onPause={() => toggleUnit(strategy.magicNumber)}
          onNotice={(text) => text && setNotice(text)} />)}
      </section> : <div className="sb-unit" role="status"><strong>No strategy records in this preview.</strong></div>}

      {pausedCount > 0 && <details className="sb-paused" open={pausedOpen} onToggle={(event) => setPausedOpen(event.currentTarget.open)} aria-label="Paused strategies" data-testid="panel-paused-strategies">
        <summary><div><div className="sb-paused-title"><ShieldAlert size={14} color="var(--amber)" /> Paused magic numbers <b>{pausedNumbers.length + orderedUnits.filter((unit) => unit.paused).length}</b></div><p>Re-enable to accept future MT5 uploads. Deleted history will not return.</p></div><ChevronDown size={15} /></summary>
        <div className="sb-paused-content">
          {pausedNumbers.map((magicNumber) => <div className="sb-paused-item" key={magicNumber}><span className="sb-paused-number">Magic #{magicNumber}</span><button type="button" onClick={() => reenablePaused(magicNumber)} data-testid={`button-resume-strategy-${magicNumber}`}>Re-enable</button></div>)}
          {orderedUnits.filter((unit) => unit.paused).map((unit) => <div className="sb-paused-item" key={unit.magicNumber}><span className="sb-paused-number">Magic #{unit.magicNumber}</span><button type="button" onClick={() => toggleUnit(unit.magicNumber)} data-testid={`button-resume-strategy-${unit.magicNumber}`}>Re-enable</button></div>)}
        </div>
      </details>}
      <p className="sb-footnote">Sample metrics are illustrative. Realized net profit includes profit, commission and swap. Sharpe is per-trade (mean ÷ standard deviation), not annualized. Amounts are USD.</p>

      <details className="sb-webhook" data-testid="webhook-setup">
        <summary><span className="sb-webhook-title">MT5 webhook setup<small>Reference only · no request is sent from this preview</small></span><span className="sb-endpoint">POST /api/trades</span></summary>
        <div className="sb-webhook-content"><p>Configure your MT5 Expert Advisor to post closed-trade records to the trade endpoint. This prototype only displays the reference path; it does not contact an API.</p><button type="button" onClick={copyWebhook} data-testid="button-copy-webhook"><Copy size={13} />{copied ? 'Copied reference' : 'Copy reference'}</button></div>
      </details>
    </div>
  </main>;
}