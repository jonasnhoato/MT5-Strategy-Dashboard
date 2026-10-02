import { Fragment, useMemo, useState, type ReactNode } from 'react';
import {
  Activity, ArrowUpRight, BarChart3, Check,
  ChevronDown, ChevronRight, Clock3, Copy, Download, GripVertical, Moon, Printer,
  RefreshCw, Sun, Trash2, WalletCards, X,
} from 'lucide-react';
import { fixture, money, percent, type StrategyPerformance } from './_fixture';
import './_group.css';

const intervals = [
  { label: '5 minutes', value: 5 * 60 * 1000 },
  { label: '15 minutes', value: 15 * 60 * 1000 },
  { label: '1 hour', value: 60 * 60 * 1000 },
  { label: '24 hours', value: 24 * 60 * 60 * 1000 },
];

function pf(value: number | null, row?: Pick<StrategyPerformance, 'losses' | 'netProfit'>) {
  if (value != null && Number.isFinite(value)) return value.toFixed(2);
  if (row && row.losses === 0 && row.netProfit > 0) return '∞';
  return '—';
}

function Stamp({ children }: { children: ReactNode }) {
  return <span className="tb-stamp">{children}</span>;
}

function MiniEquity({ strategy }: { strategy: StrategyPerformance }) {
  const ordered = useMemo(() => [...strategy.equity].sort(
    (a, b) => new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime(),
  ), [strategy.equity]);
  if (ordered.length < 2) return <div className="tb-no-equity">No closed-trade equity points.</div>;
  const values = ordered.map((point) => point.cumulativeProfit);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const spread = max - min || 1;
  const coords = values.map((value, index) => {
    const x = 4 + (index / (values.length - 1)) * 292;
    const y = 42 - ((value - min) / spread) * 36;
    return `${x},${y}`;
  }).join(' ');
  const zeroY = 42 - ((0 - min) / spread) * 36;
  const stroke = strategy.netProfit >= 0 ? '#36836a' : '#b65345';
  return <svg viewBox="0 0 300 48" preserveAspectRatio="none" className="tb-spark" role="img" aria-label={`Cumulative net profit over ${ordered.length} trade closes for magic number ${strategy.magicNumber}`}>
    <line x1="4" x2="296" y1={zeroY} y2={zeroY} stroke="currentColor" strokeDasharray="2 4" opacity=".28" />
    <polyline points={coords} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    {ordered.map((point, i) => <circle key={`${point.closeTime}-${i}`} cx={4 + (i / (ordered.length - 1)) * 292} cy={42 - ((point.cumulativeProfit - min) / spread) * 36} r="1.5" fill={stroke} />)}
  </svg>;
}

function csv(strategy: StrategyPerformance) {
  const lines = [
    'close_time,trade_net_profit,cumulative_net_profit',
    ...strategy.equity.map((point) => `${point.closeTime},${point.netProfit},${point.cumulativeProfit}`),
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `magic-${strategy.magicNumber}-net-profit-equity.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function TradingBlotter() {
  const [light, setLight] = useState(true);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [pausedOpen, setPausedOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [intervalMs, setIntervalMs] = useState(intervals[0].value);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: 'magicNumber' | 'netProfit' | 'avgTrade' | 'profitFactor' | 'winRate' | 'tradeCount'; desc: boolean }>({ key: 'netProfit', desc: true });
  const data = fixture;

  const strategies = useMemo(() => {
    const lookup = new Map(data.strategies.map((row) => [row.magicNumber, row]));
    const preferred = order.flatMap((id) => {
      const found = lookup.get(id);
      if (!found) return [];
      lookup.delete(id);
      return [found];
    });
    const all = [...preferred, ...[...lookup.values()]];
    if (order.length) return all;
    return all.sort((a, b) => {
      const av = sort.key === 'avgTrade' ? (a.tradeCount ? a.netProfit / a.tradeCount : 0) : a[sort.key] ?? -Infinity;
      const bv = sort.key === 'avgTrade' ? (b.tradeCount ? b.netProfit / b.tradeCount : 0) : b[sort.key] ?? -Infinity;
      return (Number(av) - Number(bv)) * (sort.desc ? -1 : 1);
    });
  }, [data.strategies, order, sort]);

  const reorder = (from: number, to: number) => {
    const ids = strategies.map((row) => row.magicNumber);
    const a = ids.indexOf(from);
    const b = ids.indexOf(to);
    if (a < 0 || b < 0 || a === b) return;
    const [moved] = ids.splice(a, 1);
    ids.splice(b, 0, moved);
    setOrder(ids);
  };
  const toggleSort = (key: typeof sort.key) => {
    setOrder([]);
    setSort((current) => ({ key, desc: current.key === key ? !current.desc : key !== 'magicNumber' }));
  };
  const toggleExpand = (magic: number) => setExpanded((current) =>
    current.includes(magic) ? current.filter((id) => id !== magic) : [...current, magic],
  );
  const avgNet = data.totals.tradeCount > 0 ? data.totals.netProfit / data.totals.tradeCount : 0;
  const webhookUrl = `${window.location.origin}/api/trades`;
  const updatedAt = new Date(data.latestTradeAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const sortButton = (label: string, key: typeof sort.key, align = '') => (
    <button type="button" className={`tb-sort ${align}`} onClick={() => toggleSort(key)} aria-label={`Sort by ${label}`} data-testid={`sort-${key}`}>
      {label}{sort.key === key && <span className="tb-sort-mark">{sort.desc ? '↓' : '↑'}</span>}
    </button>
  );

  return <main className={`tb ${light ? 'tb-light' : 'tb-dark'}`} id="mt5-dashboard-root">
    <div className="tb-topline"><span className="tb-mark"><Activity size={15} strokeWidth={2.2}/></span><span>PERSONAL MT5 / PERFORMANCE LEDGER</span><span className="tb-top-right">LOCAL WORKSPACE <i/></span></div>
    <div className="tb-wrap">
      <div className="tb-sample"><b>LOCAL SAMPLE</b><span>Illustrative fixture only · no account data or network connection</span><span className="tb-sample-count">{data.totals.magicNumberCount} strategies <em>/</em> {data.totals.tradeCount} closes</span></div>

      <header className="tb-header">
        <div className="tb-heading">
          <div className="tb-kicker">MT5 ACCOUNT · REALIZED ONLY</div>
          <h1>Strategy blotter<span className="tb-title-mark">/</span></h1>
          <p>Every Expert Advisor, reconciled by magic number.</p>
        </div>
        <div className="tb-controls">
          <div className="tb-settings-wrap">
            <button className="tb-button tb-refresh" type="button" onClick={() => setNotice('Local sample fixture shown. No refresh request was sent.')} data-testid="button-refresh"><RefreshCw size={14}/> Refresh</button>
            <button className="tb-icon-button tb-settings-trigger" type="button" aria-label="Dashboard settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((v) => !v)} data-testid="button-dashboard-settings"><ChevronDown size={15}/></button>
            {settingsOpen && <div className="tb-settings" role="dialog" aria-label="Refresh settings">
              <div className="tb-settings-row"><div><strong>Auto-refresh</strong><small>Preview only · no polling</small></div><button type="button" role="switch" aria-checked={autoRefresh} className={`tb-switch ${autoRefresh ? 'on' : ''}`} onClick={() => setAutoRefresh((v) => !v)} data-testid="toggle-auto-refresh"><span/></button></div>
              <div className="tb-interval-label">INTERVAL</div>
              {intervals.map((item) => <button key={item.value} className="tb-interval" type="button" disabled={!autoRefresh} onClick={() => setIntervalMs(item.value)}>{item.label}{intervalMs === item.value && <Check size={13}/>}</button>)}
            </div>}
          </div>
          <button className="tb-button tb-danger" type="button" onClick={() => setNotice('Clear all trades is disabled in this local sample preview.')} data-testid="button-clear-all-trades"><Trash2 size={14}/><span>Clear history</span></button>
          <button className="tb-button tb-icon-button" type="button" onClick={() => window.print()} aria-label="Export dashboard as PDF" title="Print / PDF" data-testid="button-export-pdf"><Printer size={15}/></button>
          <button className="tb-button tb-icon-button" type="button" onClick={() => setLight((v) => !v)} aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'} data-testid="button-toggle-theme">{light ? <Moon size={15}/> : <Sun size={15}/>}</button>
        </div>
      </header>

      {notice && <div className="tb-notice" role="status" data-testid="status-notice"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={14}/></button></div>}

      <section className="tb-account" aria-label="Account-wide performance summary">
        <div className="tb-section-head"><div><WalletCards size={15}/><h2>ACCOUNT TOTALS</h2></div><span>Closed trades · account currency USD</span></div>
        <div className="tb-metrics">
          <div className="tb-major-metric"><span>NET PROFIT <ArrowUpRight size={13}/></span><strong className={data.totals.netProfit < 0 ? 'negative' : 'positive'}>{money(data.totals.netProfit)}</strong><small>realized + commission + swap</small></div>
          <div className="tb-metric"><span>AVG NET / TRADE</span><strong className={avgNet < 0 ? 'negative' : 'positive'}>{money(avgNet)}</strong><small>net ÷ closed trades</small></div>
          <div className="tb-metric"><span>PROFIT FACTOR</span><strong>{pf(data.totals.profitFactor, data.totals)}</strong><small>gross wins ÷ gross losses</small></div>
          <div className="tb-metric"><span>WIN RATE</span><strong>{percent(data.totals.winRate)}</strong><small>{data.totals.wins}W <i>/</i> {data.totals.losses}L</small></div>
          <div className="tb-metric"><span>MAX DRAWDOWN</span><strong className="negative">{money(data.totals.maxDrawdown)}</strong><small>peak to trough</small></div>
          <div className="tb-metric"><span>STRATEGIES</span><strong>{data.totals.magicNumberCount}</strong><small>unique magic numbers</small></div>
          <div className="tb-metric"><span>CLOSED TRADES</span><strong>{data.totals.tradeCount.toLocaleString()}</strong><small>all strategies</small></div>
        </div>
        <div className="tb-method"><span><b>METHOD</b> Net = realized profit + commission + swap</span><span>Sharpe <b>{data.totals.sharpeRatio?.toFixed(2) ?? '—'}</b> per-trade · not annualized</span><span>Payout <b>{data.totals.payoutRatio == null ? '—' : `${data.totals.payoutRatio.toFixed(2)}×`}</b></span></div>
      </section>

      <section className="tb-ledger" aria-label="Strategy performance">
        <div className="tb-ledger-head">
          <div><div className="tb-section-head"><div><BarChart3 size={15}/><h2>STRATEGY COMPARISON</h2></div><Stamp>{strategies.length} ACTIVE</Stamp></div><p>Sort any column · open a row for risk, payout and realized equity.</p></div>
          <div className="tb-updated"><Clock3 size={12}/> Updated {updatedAt}</div>
        </div>
        <div className="tb-table-scroll">
          <table className="tb-table">
            <thead><tr>
              <th className="tb-grip-heading" aria-label="Reorder"/><th>{sortButton('MAGIC / SYMBOLS', 'magicNumber')}</th>
              <th className="tb-align-right">{sortButton('NET PROFIT', 'netProfit', 'right')}</th>
              <th className="tb-align-right">{sortButton('AVG / TRADE', 'avgTrade', 'right')}</th>
              <th className="tb-align-right">{sortButton('PF', 'profitFactor', 'right')}</th>
              <th className="tb-align-right">{sortButton('WIN RATE', 'winRate', 'right')}</th>
              <th className="tb-align-right">{sortButton('CLOSED', 'tradeCount', 'right')}</th>
              <th className="tb-row-open-heading"/>
            </tr></thead>
            <tbody>
              {strategies.map((row, index) => {
                const isOpen = expanded.includes(row.magicNumber);
                const isDragging = dragging === row.magicNumber;
                const tradeAverage = row.tradeCount ? row.netProfit / row.tradeCount : 0;
                return <Fragment key={row.magicNumber}>
                  <tr className={`tb-data-row ${isOpen ? 'is-open' : ''} ${isDragging ? 'is-dragging' : ''}`} draggable onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(row.magicNumber));
                    setDragging(row.magicNumber);
                  }} onDragEnd={() => setDragging(null)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={(event) => {
                    event.preventDefault();
                    const source = Number(event.dataTransfer.getData('text/plain'));
                    if (Number.isSafeInteger(source)) reorder(source, row.magicNumber);
                    setDragging(null);
                  }} data-testid={`row-strategy-${row.magicNumber}`}>
                    <td className="tb-grip-cell"><button type="button" className="tb-grip" aria-label={`Reorder magic number ${row.magicNumber}; use arrow keys`} title="Drag or use arrow keys to reorder" onKeyDown={(event) => {
                      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                        event.preventDefault();
                        const target = strategies[index + (event.key === 'ArrowUp' ? -1 : 1)];
                        if (target) reorder(row.magicNumber, target.magicNumber);
                      }
                    }}><GripVertical size={15}/></button></td>
                    <td className="tb-id-cell"><button type="button" className="tb-row-expander" onClick={() => toggleExpand(row.magicNumber)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Expand'} magic number ${row.magicNumber}`} data-testid={`button-toggle-details-${row.magicNumber}`}><ChevronRight size={14}/></button><div><strong className="tb-magic">#{row.magicNumber}</strong><div className="tb-symbols">{row.symbols.length ? row.symbols.map((symbol) => <span key={symbol}>{symbol}</span>) : <i>No ticker data</i>}</div><div className="tb-mobile-extra">PF {pf(row.profitFactor, row)} <i>/</i> {percent(row.winRate)} wins <i>/</i> {row.tradeCount} closes</div></div></td>
                    <td className={`tb-num ${row.netProfit < 0 ? 'negative' : 'positive'}`}>{money(row.netProfit)}</td>
                    <td className={`tb-num ${tradeAverage < 0 ? 'negative' : 'positive'}`}>{money(tradeAverage)}</td>
                    <td className="tb-num">{pf(row.profitFactor, row)}</td>
                    <td className="tb-num">{percent(row.winRate)}</td>
                    <td className="tb-num">{row.tradeCount}</td>
                    <td><button type="button" className="tb-open-link" onClick={() => toggleExpand(row.magicNumber)}>{isOpen ? 'Close' : 'Details'}<ChevronDown size={12}/></button></td>
                  </tr>
                  {isOpen && <tr className="tb-detail-row"><td colSpan={8}>
                    <div className="tb-detail-wrap">
                      <div className="tb-detail-head"><span>MAGIC #{row.magicNumber} <b>·</b> EXACT REALIZED PERFORMANCE</span><div className="tb-row-actions">
                        <button type="button" className="tb-small-action" onClick={() => csv(row)} disabled={!row.equity.length} data-testid={`export-csv-${row.magicNumber}`}><Download size={12}/> Export equity CSV</button>
                        <button type="button" className="tb-small-action tb-delete-action" onClick={() => setNotice(`Delete history for magic number ${row.magicNumber} is disabled in the local sample preview.`)} data-testid={`button-delete-strategy-${row.magicNumber}`}><Trash2 size={12}/> Delete history</button>
                      </div></div>
                      <div className="tb-detail-grid">
                        <div><span>MAX DRAWDOWN</span><b className="negative">{money(row.maxDrawdown)}</b></div>
                        <div><span>AVG NET / TRADE</span><b className={tradeAverage < 0 ? 'negative' : 'positive'}>{money(tradeAverage)}</b></div>
                        <div><span>SHARPE · PER TRADE</span><b>{row.sharpeRatio == null ? '—' : row.sharpeRatio.toFixed(2)}</b></div>
                        <div><span>PAYOUT RATIO</span><b>{row.payoutRatio == null ? '—' : `${row.payoutRatio.toFixed(2)}×`}</b></div>
                        <div><span>WINS / LOSSES</span><b>{row.wins} / {row.losses}</b></div>
                        <div><span>BREAKEVEN</span><b>{row.breakeven}</b></div>
                      </div>
                      <div className="tb-equity">
                        <div className="tb-equity-title"><div><b>CUMULATIVE NET PROFIT</b><small>Closed trades in close-time order · USD</small></div><span>{row.equity.length} closes</span></div>
                        <MiniEquity strategy={row}/>
                        <div className="tb-equity-range"><span>{row.equity[0] ? new Date(row.equity[0].closeTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span><span>cumulative realized net</span><span>{row.equity.length ? new Date(row.equity[row.equity.length - 1].closeTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span></div>
                      </div>
                    </div>
                  </td></tr>}
                </Fragment>;
              })}
            </tbody>
          </table>
        </div>
        <div className="tb-table-foot"><span><GripVertical size={12}/> Drag rows or focus the grip and press ↑ / ↓ to reorder.</span><span>Sorted by {sort.key === 'avgTrade' ? 'average net / trade' : sort.key === 'netProfit' ? 'net profit' : sort.key}{order.length ? ' · custom order' : ''}</span></div>
      </section>

      <details className="tb-paused" open={pausedOpen} onToggle={(event) => setPausedOpen(event.currentTarget.open)} data-testid="panel-paused-strategies">
        <summary><div><span className="tb-paused-label">PAUSED MAGIC NUMBERS</span><span className="tb-paused-count">{data.pausedMagicNumbers.length}</span><p>Re-enable to accept future MT5 uploads. Deleted history will not return.</p></div><ChevronDown size={15}/></summary>
        {pausedOpen && <div className="tb-paused-body">{data.pausedMagicNumbers.map((magic) => <div className="tb-paused-item" key={magic}><span>#{magic}</span><button type="button" onClick={() => setNotice(`Re-enable for magic number ${magic} is disabled in the local sample preview.`)} data-testid={`button-resume-strategy-${magic}`}>Re-enable</button></div>)}</div>}
      </details>

      <div className="tb-footnote"><span>Illustrative sample metrics. Not connected to an MT5 account.</span><span>Net = realized profit + commission + swap. Sharpe is per-trade, not annualized.</span></div>
      <details className="tb-webhook" open={webhookOpen} onToggle={(event) => setWebhookOpen(event.currentTarget.open)} data-testid="webhook-setup">
        <summary><span><b>MT5 WEBHOOK SETUP</b><small>Reference only · preview sends no requests</small></span><span className="tb-endpoint">POST /api/trades <ChevronDown size={13}/></span></summary>
        {webhookOpen && <div className="tb-webhook-body"><div><span>ENDPOINT</span><code>{webhookUrl}</code><button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(webhookUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); }
          catch { setNotice('Clipboard is unavailable in this preview.'); }
        }}><Copy size={13}/>{copied ? 'Copied' : 'Copy URL'}</button></div><p>Send closed-trade records from your MT5 Expert Advisor. Configure the endpoint in your EA only when connected to a live service. This local preview does not receive uploads.</p><pre>{'// POST /api/trades — reference only\\n{ \"magic\": 26001, \"symbol\": \"EURUSD\", \"profit\": 82.40, \"commission\": -1.20, \"swap\": 0.00 }'}</pre></div>}
      </details>
    </div>

    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
      .tb#mt5-dashboard-root{--paper:#edf0e9;--surface:#f6f7f2;--surface2:#e5e9e1;--line:#cbd3c9;--ink:#182922;--muted:#65736b;--accent:#276c56;--accent-soft:#e0ece4;--gain:#247556;--loss:#ad5143;--gold:#c49a55;min-height:100dvh;background:var(--paper);color:var(--ink);font-family:'DM Sans',sans-serif;font-size:13px;line-height:1.45;transition:background-color .18s,color .18s}
      .tb *{box-sizing:border-box}.tb button{font:inherit;color:inherit}.tb button:focus-visible,.tb summary:focus-visible,.tb .tb-data-row:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      .tb#mt5-dashboard-root.tb-dark{--paper:#18231f;--surface:#202d27;--surface2:#26362e;--line:#35473c;--ink:#e3ebe3;--muted:#a0afa3;--accent:#91c9a9;--accent-soft:#2d4739;--gain:#8bcea9;--loss:#e28b79;--gold:#d6b879}
      .tb-topline{height:37px;padding:0 max(20px,calc((100vw - 1480px)/2));background:#203c31;color:#c7d8c8;display:flex;align-items:center;gap:10px;font:500 9px 'DM Mono',monospace;letter-spacing:.12em}
      .tb-mark{width:19px;height:19px;border:1px solid #789580;color:#d1e3ce;display:grid;place-items:center;border-radius:4px}.tb-top-right{margin-left:auto;color:#9cbaa4}.tb-top-right i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#a6c967;margin-left:7px}
      .tb-wrap{max-width:1500px;margin:0 auto;padding:21px 30px 50px}.tb-sample{display:flex;align-items:center;gap:10px;min-height:32px;padding:6px 10px;border-left:2px solid var(--gold);background:var(--surface);color:var(--muted);font-size:10px}.tb-sample b{color:#826738;font:500 9px 'DM Mono',monospace;letter-spacing:.1em}.tb-dark .tb-sample b{color:#d6b879}.tb-sample-count{margin-left:auto;color:var(--ink);font:11px 'DM Mono',monospace}.tb-sample-count em{color:var(--muted);font-style:normal;margin:0 4px}
      .tb-header{display:flex;justify-content:space-between;align-items:flex-end;gap:22px;border-bottom:1px solid var(--line);padding:23px 1px 18px}.tb-kicker{color:var(--accent);font:500 9px 'DM Mono',monospace;letter-spacing:.14em}.tb-heading h1{margin:5px 0 0;font:800 30px/1.05 Manrope,sans-serif;letter-spacing:-.055em}.tb-title-mark{color:var(--gold);padding-left:2px}.tb-heading p{margin:7px 0 0;color:var(--muted);font-size:12px}
      .tb-controls{display:flex;gap:6px;align-items:center}.tb-button{height:33px;border:1px solid var(--line);background:var(--surface);padding:0 10px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:4px;color:var(--ink);font-size:11px;font-weight:600;cursor:pointer;transition:background-color .15s,border-color .15s,color .15s}.tb-button:hover,.tb-icon-button:hover{background:var(--surface2);border-color:var(--accent)}.tb-refresh{background:var(--accent);border-color:var(--accent);color:#f7f5ec}.tb-refresh:hover{background:#1c5945}.tb-danger{border-color:#d7b1a9;color:var(--loss);background:transparent}.tb-danger:hover{background:#f4e8e3;border-color:var(--loss)}.tb-dark .tb-danger:hover{background:#482f2b}.tb-icon-button{width:34px;padding:0}.tb-settings-wrap{position:relative;display:flex}.tb-settings-trigger{margin-left:-7px;border-left:0;border-radius:0 4px 4px 0;width:28px}.tb-settings{position:absolute;z-index:9;top:39px;right:0;width:230px;padding:12px;background:var(--surface);border:1px solid var(--line);box-shadow:0 12px 25px #12251d2b;border-radius:5px}.tb-settings-row{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--line)}.tb-settings-row strong,.tb-settings-row small{display:block}.tb-settings-row strong{font-size:11px}.tb-settings-row small{font-size:9px;color:var(--muted);margin-top:2px}.tb-switch{width:34px;height:19px;border:0;border-radius:20px;background:var(--line);padding:2px;cursor:pointer}.tb-switch span{display:block;width:15px;height:15px;border-radius:50%;background:var(--surface);transition:transform .15s}.tb-switch.on{background:var(--accent)}.tb-switch.on span{transform:translateX(15px)}.tb-interval-label{font:9px 'DM Mono',monospace;color:var(--muted);letter-spacing:.12em;margin:9px 0 4px}.tb-interval{width:100%;display:flex;align-items:center;justify-content:space-between;border:0;background:transparent;border-radius:3px;padding:6px;color:var(--ink);font-size:11px;text-align:left;cursor:pointer}.tb-interval:hover:not(:disabled){background:var(--surface2)}.tb-interval:disabled{opacity:.4;cursor:not-allowed}.tb-interval svg{color:var(--accent)}
      .tb-notice{margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 11px;background:var(--accent-soft);border:1px solid var(--line);font-size:11px}.tb-notice button{display:grid;place-items:center;border:0;background:transparent;cursor:pointer;color:var(--muted)}
      .tb-account{margin-top:20px}.tb-section-head{display:flex;align-items:center;gap:8px}.tb-section-head>div{display:flex;align-items:center;gap:8px;color:var(--accent)}.tb-section-head h2{margin:0;color:var(--ink);font:700 10px 'DM Mono',monospace;letter-spacing:.11em}.tb-section-head>span{color:var(--muted);font-size:10px;margin-left:auto}.tb-metrics{display:grid;grid-template-columns:1.48fr repeat(6,minmax(90px,1fr));margin-top:9px;border:1px solid var(--line);background:var(--line);gap:1px}.tb-metric,.tb-major-metric{min-width:0;background:var(--surface);padding:12px 11px}.tb-major-metric{background:var(--accent-soft);padding-left:14px}.tb-metric>span,.tb-major-metric>span{display:flex;gap:4px;align-items:center;color:var(--muted);font:500 8px 'DM Mono',monospace;letter-spacing:.06em;white-space:nowrap}.tb-major-metric>span{color:var(--accent)}.tb-metric strong,.tb-major-metric strong{display:block;margin-top:7px;color:var(--ink);font:500 15px 'DM Mono',monospace;letter-spacing:-.055em;white-space:nowrap}.tb-major-metric strong{font-size:22px}.tb-metric small,.tb-major-metric small{display:block;color:var(--muted);font-size:9px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tb-metric small i{font-style:normal;color:var(--muted);padding:0 2px}.tb .positive{color:var(--gain)!important}.tb .negative{color:var(--loss)!important}.tb-method{margin-top:7px;display:flex;flex-wrap:wrap;gap:7px 20px;color:var(--muted);font-size:9px}.tb-method b{color:var(--ink);font-family:'DM Mono',monospace}.tb-method>span:first-child b{color:var(--accent);letter-spacing:.06em}
      .tb-ledger{margin-top:28px}.tb-ledger-head{display:flex;align-items:flex-end;justify-content:space-between;gap:15px;margin-bottom:9px}.tb-ledger-head p{margin:5px 0 0;color:var(--muted);font-size:10px}.tb-stamp{border:1px solid var(--line);padding:2px 6px;color:var(--muted);font:9px 'DM Mono',monospace;letter-spacing:.04em}.tb-updated{display:flex;gap:5px;align-items:center;color:var(--muted);font:9px 'DM Mono',monospace;white-space:nowrap}
      .tb-table-scroll{overflow-x:auto;border:1px solid var(--line);background:var(--surface)}.tb-table{width:100%;border-collapse:collapse;min-width:760px}.tb-table thead{background:var(--surface2)}.tb-table th{height:31px;padding:0 9px;text-align:left;border-bottom:1px solid var(--line);color:var(--muted);font:500 8px 'DM Mono',monospace;letter-spacing:.09em;white-space:nowrap}.tb-table th.tb-align-right{text-align:right}.tb-sort{display:inline-flex;gap:5px;align-items:center;border:0;padding:0;background:transparent;color:inherit;font:inherit;letter-spacing:inherit;cursor:pointer}.tb-sort:hover{color:var(--accent)}.tb-sort.right{justify-content:flex-end;width:100%}.tb-sort-mark{color:var(--accent);font-size:11px}.tb-grip-heading,.tb-grip-cell{width:30px;padding:0!important;text-align:center!important}.tb-row-open-heading{width:68px}.tb-data-row{height:54px;border-bottom:1px solid var(--line);transition:background-color .14s,opacity .14s}.tb-data-row:hover{background:var(--accent-soft)}.tb-data-row.is-open{background:var(--accent-soft)}.tb-data-row.is-dragging{opacity:.4}.tb-grip{display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:#9aa69c;cursor:grab;padding:3px}.tb-grip:active{cursor:grabbing}.tb-id-cell{display:flex;align-items:center;gap:8px;padding:7px 9px!important}.tb-row-expander{display:grid;place-items:center;width:21px;height:21px;flex:none;border:1px solid var(--line);background:var(--surface);color:var(--muted);border-radius:3px;cursor:pointer}.tb-row-expander[aria-expanded=true] svg{transform:rotate(90deg)}.tb-magic{font:500 12px 'DM Mono',monospace;letter-spacing:-.04em}.tb-symbols{display:flex;gap:4px;margin-top:4px}.tb-symbols span{padding:1px 4px;border:1px solid var(--line);background:var(--surface);color:var(--accent);font:9px 'DM Mono',monospace}.tb-symbols i{font-size:9px;color:var(--muted);font-style:normal}.tb-num{text-align:right;padding:0 10px!important;font:11px 'DM Mono',monospace;font-variant-numeric:tabular-nums;white-space:nowrap}.tb-open-link{display:inline-flex;align-items:center;gap:4px;border:0;background:transparent;color:var(--accent);font-size:10px;font-weight:600;cursor:pointer;padding:6px}.tb-open-link:hover{text-decoration:underline}
      .tb-detail-row>td{padding:0!important;background:var(--surface2);border-bottom:1px solid var(--line)}.tb-detail-wrap{padding:13px 18px 15px 47px;border-left:2px solid var(--accent)}.tb-detail-head{display:flex;justify-content:space-between;align-items:center;gap:14px;color:var(--muted);font:9px 'DM Mono',monospace;letter-spacing:.05em}.tb-detail-head>b,.tb-detail-head span b{color:var(--gold)}.tb-row-actions{display:flex;gap:6px}.tb-small-action{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:3px;background:var(--surface);padding:5px 7px;color:var(--muted);font-size:9px;cursor:pointer}.tb-small-action:hover{border-color:var(--accent);color:var(--accent)}.tb-small-action:disabled{opacity:.4;cursor:not-allowed}.tb-delete-action{color:var(--loss)}.tb-detail-grid{display:grid;grid-template-columns:repeat(6,minmax(100px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);margin-top:11px}.tb-detail-grid>div{background:var(--surface);padding:8px 9px}.tb-detail-grid span{display:block;color:var(--muted);font:8px 'DM Mono',monospace;letter-spacing:.06em;white-space:nowrap}.tb-detail-grid b{display:block;margin-top:5px;font:11px 'DM Mono',monospace}.tb-equity{margin-top:13px;border:1px solid var(--line);background:var(--surface);padding:9px 11px 7px}.tb-equity-title{display:flex;align-items:center;justify-content:space-between}.tb-equity-title b{display:block;font:9px 'DM Mono',monospace;letter-spacing:.07em}.tb-equity-title small{display:block;color:var(--muted);font-size:9px;margin-top:2px}.tb-equity-title>span{color:var(--muted);font:9px 'DM Mono',monospace}.tb-spark{width:100%;height:49px;margin-top:5px;color:var(--muted);overflow:visible}.tb-no-equity{padding:14px;color:var(--muted);font-size:10px}.tb-equity-range{display:flex;justify-content:space-between;color:var(--muted);font:8px 'DM Mono',monospace}
      .tb-table-foot{display:flex;justify-content:space-between;gap:12px;padding:7px 9px;color:var(--muted);font-size:9px}.tb-table-foot>span:first-child{display:flex;align-items:center;gap:5px}
      .tb-paused{margin-top:18px;border:1px solid var(--line);background:var(--surface)}.tb-paused summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:11px 13px}.tb-paused summary::-webkit-details-marker,.tb-webhook summary::-webkit-details-marker{display:none}.tb-paused summary>div{display:grid;grid-template-columns:auto auto;align-items:center;gap:7px}.tb-paused summary>svg{color:var(--muted)}.tb-paused[open] summary>svg,.tb-webhook[open] .tb-endpoint svg{transform:rotate(180deg)}.tb-paused-label{font:10px 'DM Mono',monospace;letter-spacing:.08em;font-weight:500}.tb-paused-count{padding:1px 6px;border:1px solid var(--line);border-radius:10px;color:var(--muted);font:9px 'DM Mono',monospace}.tb-paused summary p{grid-column:1/3;margin:0;color:var(--muted);font-size:9px}.tb-paused-body{display:flex;gap:7px;flex-wrap:wrap;padding:0 13px 12px}.tb-paused-item{display:flex;align-items:center;gap:8px;padding:4px 5px 4px 9px;border:1px solid var(--line);background:var(--paper);font:10px 'DM Mono',monospace}.tb-paused-item button{border:1px solid var(--line);background:var(--surface);color:var(--accent);padding:4px 7px;font:600 9px 'DM Sans',sans-serif;cursor:pointer}.tb-paused-item button:hover{border-color:var(--accent);background:var(--accent-soft)}
      .tb-footnote{display:flex;justify-content:space-between;gap:12px;margin-top:10px;color:var(--muted);font-size:9px}.tb-webhook{margin-top:20px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.tb-webhook summary{list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 2px;cursor:pointer}.tb-webhook summary>span:first-child b{font:600 9px 'DM Mono',monospace;letter-spacing:.1em}.tb-webhook summary small{margin-left:10px;color:var(--muted);font-size:9px}.tb-endpoint{display:flex;align-items:center;gap:9px;color:var(--accent);font:10px 'DM Mono',monospace}.tb-webhook-body{padding:0 2px 14px}.tb-webhook-body>div{display:flex;align-items:center;gap:10px}.tb-webhook-body>div>span{font:9px 'DM Mono',monospace;color:var(--muted)}.tb-webhook-body code{font:10px 'DM Mono',monospace;color:var(--accent);overflow-wrap:anywhere}.tb-webhook-body button{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);background:var(--surface);padding:5px 7px;color:var(--ink);font-size:9px;cursor:pointer}.tb-webhook-body p{color:var(--muted);font-size:10px;max-width:720px}.tb-webhook-body pre{overflow:auto;background:var(--surface2);border:1px solid var(--line);padding:9px;color:var(--ink);font:10px/1.6 'DM Mono',monospace}
      @media(max-width:1050px){.tb-wrap{padding-inline:20px}.tb-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.tb-major-metric{grid-column:span 1}.tb-detail-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:700px){.tb-topline{padding-inline:13px;font-size:8px}.tb-wrap{padding:13px 12px 30px}.tb-sample{align-items:flex-start;flex-wrap:wrap;gap:4px 8px;font-size:9px}.tb-sample-count{margin-left:auto}.tb-header{align-items:flex-start;flex-direction:column;padding:18px 1px 13px;gap:13px}.tb-heading h1{font-size:27px}.tb-controls{width:100%;flex-wrap:wrap}.tb-controls .tb-danger{margin-left:auto}.tb-account{margin-top:16px}.tb-section-head>span{font-size:9px}.tb-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.tb-major-metric{grid-column:span 2}.tb-major-metric strong{font-size:23px}.tb-metric,.tb-major-metric{padding:10px}.tb-metric strong{font-size:14px}.tb-method{gap:5px 13px}.tb-ledger{margin-top:23px}.tb-ledger-head{align-items:flex-start;flex-direction:column;gap:6px}.tb-updated{align-self:flex-end}.tb-table-scroll{overflow:visible;border:0;background:transparent}.tb-table{min-width:0;display:block}.tb-table thead{display:none}.tb-table tbody{display:grid;gap:8px}.tb-table tbody tr.tb-data-row{display:grid;grid-template-columns:26px minmax(0,1fr) auto;grid-template-rows:auto auto;position:relative;border:1px solid var(--line);background:var(--surface);padding:8px 42px 8px 9px;min-height:76px}.tb-data-row:hover,.tb-data-row.is-open{background:var(--surface)}.tb-grip-cell{grid-column:1;grid-row:1/3;display:flex;align-items:center;justify-content:center!important}.tb-id-cell{grid-column:2;grid-row:1/3;padding:0 6px!important;align-self:center}.tb-row-expander{width:19px;height:19px}.tb-num{padding:1px 0!important;text-align:right!important;font-size:11px}.tb-num:nth-of-type(3){grid-column:3;grid-row:1;align-self:end}.tb-num:nth-of-type(4){grid-column:3;grid-row:2;align-self:start;font-size:10px;color:var(--muted)!important}.tb-data-row>td:nth-of-type(5),.tb-data-row>td:nth-of-type(6),.tb-data-row>td:nth-of-type(7){display:none}.tb-data-row>td:last-child{position:absolute;right:8px;top:50%;transform:translateY(-50%)}.tb-data-row>td:nth-of-type(3),.tb-data-row>td:nth-of-type(4){padding-right:4px!important}.tb .tb-open-link{width:23px;height:23px;font-size:0!important;padding:4px}.tb-open-link svg{width:15px;height:15px}.tb-detail-row{display:block!important;border:1px solid var(--line);border-top:0;background:var(--surface2)}.tb-detail-row>td{display:block}.tb-detail-wrap{padding:11px;border-left:2px solid var(--accent)}.tb-detail-head{align-items:flex-start;flex-direction:column;gap:9px}.tb-row-actions{flex-wrap:wrap}.tb-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:9px}.tb-detail-grid>div{padding:7px}.tb-detail-grid span{font-size:7px}.tb-table-foot{font-size:8px;flex-wrap:wrap}.tb-footnote{flex-direction:column;gap:4px}.tb-webhook summary small{display:block;margin:3px 0 0}.tb-webhook-body>div{align-items:flex-start;flex-wrap:wrap}.tb-webhook-body code{flex:1;min-width:150px}.tb-settings{left:0;right:auto}.tb-updated{font-size:8px}}
      @media print{.tb{background:#fff!important;color:#182922!important}.tb-topline,.tb-controls,.tb-grip-cell,.tb-row-actions,.tb-open-link,.tb-paused,.tb-webhook{display:none!important}.tb-wrap{max-width:none;padding:10px}.tb-table-scroll{overflow:visible}.tb-table{min-width:0}.tb-data-row{break-inside:avoid}.tb-detail-row{display:table-row!important}}
      @media(prefers-reduced-motion:reduce){.tb,.tb *{transition:none!important;scroll-behavior:auto!important}}
    `}</style>
    <style>{`
      .tb .tb-mobile-extra{display:none}
      .tb .tb-mobile-extra i{padding:0 2px;color:var(--muted);font-style:normal}
      @media(max-width:700px){
        .tb .tb-mobile-extra{display:block;margin-top:4px;color:var(--muted);font:8px 'DM Mono',monospace;white-space:nowrap}
        .tb .tb-table tbody tr.tb-data-row{min-height:83px}
      }
    `}</style>
  </main>;
}