import { useMemo, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, Check, ChevronDown, ChevronUp, Clock3, Download, GripVertical, Moon,
  Printer, RefreshCw, Settings2, Sun, Trash2, TrendingUp, WalletCards, X,
} from 'lucide-react';
import { fixture, money, percent, type StrategyPerformance } from './_fixture';
import './_group.css';

const intervals = ['5 minutes', '15 minutes', '1 hour', '24 hours'];
const compactMoney = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
}).format(value);
const ratio = (value: number | null, strategy?: Pick<StrategyPerformance, 'losses' | 'netProfit'>) =>
  value == null || !Number.isFinite(value) ? strategy?.losses === 0 && (strategy?.netProfit ?? 0) > 0 ? '∞' : '—' : value.toFixed(2);
const stamp = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return <div className="ca-tooltip">
    <div className="ca-tip-date">{new Date(label).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
    <div className={`ca-tip-value ${payload[0].value >= 0 ? 'up' : 'down'}`}>{money(payload[0].value)}</div>
    <div className="ca-tip-label">Cumulative net profit · USD</div>
  </div>;
}

export function ChartAnalytics() {
  const [order, setOrder] = useState(fixture.strategies.map((item) => item.magicNumber));
  const [selectedMagic, setSelectedMagic] = useState(fixture.strategies[0].magicNumber);
  const [expanded, setExpanded] = useState(false);
  const [light, setLight] = useState(true);
  const [settings, setSettings] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [interval, setInterval] = useState(intervals[0]);
  const [pausedOpen, setPausedOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  const strategies = useMemo(() => order.flatMap((id) => {
    const found = fixture.strategies.find((item) => item.magicNumber === id);
    return found ? [found] : [];
  }), [order]);
  const selected = strategies.find((item) => item.magicNumber === selectedMagic) ?? strategies[0];
  const points = useMemo(() => [...selected.equity].sort(
    (a, b) => new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime(),
  ), [selected]);
  const net = fixture.totals.netProfit;
  const moveStrategy = (magic: number, direction: -1 | 1) => {
    const index = order.indexOf(magic);
    const next = index + direction;
    if (next < 0 || next >= order.length) return;
    const updated = [...order];
    [updated[index], updated[next]] = [updated[next], updated[index]];
    setOrder(updated);
  };
  const exportCsv = (strategy: StrategyPerformance) => {
    const rows = ['close_time,trade_net_profit,cumulative_net_profit',
      ...strategy.equity.map((point) => `${point.closeTime},${point.netProfit},${point.cumulativeProfit}`)];
    const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `magic-${strategy.magicNumber}-net-profit-equity.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/api/trades`);
      setCopied(true);
      setNotice('Webhook reference copied. No request was sent.');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice('Clipboard access is unavailable in this preview.');
    }
  };

  return <main className={`ca-root ${light ? 'ca-light' : 'ca-dark'}`}>
    <style>{`
      .ca-root{--ink:#183932;--muted:#71887f;--line:#dce8df;--paper:#f1f6ef;--surface:#f9fcf7;--surface2:#e8f1e8;--accent:#18775f;--accent-soft:#dceee3;--loss:#b85c50;--gain:#167452;--shadow:0 16px 42px rgba(38,83,62,.07);min-height:100dvh;background:radial-gradient(ellipse at 75% 0%,#e3f1e7 0,transparent 36%),var(--paper);color:var(--ink);font-family:'DM Sans',sans-serif;padding:25px clamp(16px,4.5vw,68px) 52px;transition:background .25s,color .25s}
      .ca-root *{box-sizing:border-box}.ca-dark{--ink:#dcebe2;--muted:#9aafa3;--line:#30493f;--paper:#14231e;--surface:#1b2d25;--surface2:#24392f;--accent:#83c9a7;--accent-soft:#284739;--gain:#85d1a8;--loss:#ed988a;--shadow:0 16px 42px rgba(0,0,0,.2);background:radial-gradient(ellipse at 75% 0%,#203a2d 0,transparent 38%),var(--paper)}
      .ca-wrap{max-width:1440px;margin:0 auto}.ca-topline{display:flex;justify-content:space-between;align-items:center;gap:14px;border-bottom:1px solid var(--line);padding-bottom:18px}.ca-brand{display:flex;gap:12px;align-items:center}.ca-brand-mark{width:39px;height:39px;display:grid;place-items:center;border-radius:12px;color:var(--accent);background:var(--accent-soft);border:1px solid var(--line)}.ca-kicker{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}.ca-title{font-family:Manrope,sans-serif;font-size:22px;line-height:1.15;letter-spacing:-.05em;font-weight:800;margin:2px 0 0}.ca-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.ca-btn{font:600 11px 'DM Sans',sans-serif;display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:9px;padding:9px 11px;background:var(--surface);color:var(--ink);cursor:pointer;transition:background .18s,transform .18s,border-color .18s}.ca-btn:hover{background:var(--surface2);border-color:var(--accent)}.ca-btn:active{transform:translateY(1px)}.ca-btn:focus-visible,.ca-select:focus-visible,.ca-nav:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 45%,transparent);outline-offset:2px}.ca-btn.danger{color:var(--loss);border-color:color-mix(in srgb,var(--loss) 35%,var(--line));background:color-mix(in srgb,var(--loss) 7%,var(--surface))}.ca-square{width:36px;height:36px;padding:0;justify-content:center}.ca-sample{margin:16px 0 25px;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 13px;border:1px solid color-mix(in srgb,var(--accent) 26%,var(--line));border-radius:10px;background:color-mix(in srgb,var(--accent-soft) 55%,var(--surface));font-size:10px;color:var(--muted)}.ca-sample b{color:var(--accent);letter-spacing:.12em}.ca-sample-right{font-family:'DM Mono',monospace;white-space:nowrap}.ca-layout{display:grid;grid-template-columns:minmax(0,1fr) 246px;gap:18px;align-items:start}.ca-maincol{min-width:0}.ca-eyebrow{font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--muted)}.ca-hero{padding:21px 23px 18px;border:1px solid var(--line);border-radius:17px;background:var(--surface);box-shadow:var(--shadow);position:relative;overflow:visible}.ca-hero-top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.ca-focus-label{display:flex;align-items:center;gap:7px;color:var(--accent);font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.ca-strategy-title{margin:8px 0 4px;font:800 clamp(19px,2.6vw,28px)/1.12 Manrope,sans-serif;letter-spacing:-.05em}.ca-symbols{display:flex;gap:6px;flex-wrap:wrap}.ca-chip{border:1px solid var(--line);border-radius:5px;padding:3px 7px;color:var(--accent);background:var(--accent-soft);font:600 9px 'DM Mono',monospace;letter-spacing:.03em}.ca-hero-stat{text-align:right;flex:none}.ca-hero-net{font:700 clamp(22px,3vw,32px)/1.05 'DM Mono',monospace;letter-spacing:-.06em;color:var(--gain)}.ca-hero-stat small{display:block;margin-top:6px;color:var(--muted);font-size:10px}.ca-chart-caption{display:flex;justify-content:space-between;align-items:end;gap:12px;margin:22px 2px 0}.ca-chart-caption strong{font-size:12px}.ca-chart-caption span{display:block;color:var(--muted);font-size:10px;margin-top:3px}.ca-chart-legend{font:10px 'DM Mono',monospace;color:var(--muted)}.ca-chart{height:264px;margin-top:8px}.ca-tooltip{border-radius:9px;border:1px solid var(--line);padding:10px 12px;background:var(--surface);box-shadow:var(--shadow);min-width:180px}.ca-tip-date{font-size:10px;color:var(--muted)}.ca-tip-value{font:600 15px 'DM Mono',monospace;margin-top:7px}.ca-tip-value.up{color:var(--gain)}.ca-tip-value.down{color:var(--loss)}.ca-tip-label{font-size:9px;color:var(--muted);margin-top:2px}.ca-metric-strip{margin-top:13px;padding:14px 16px;border:1px solid var(--line);border-radius:13px;background:var(--surface);display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px}.ca-metric{min-width:0;border-right:1px solid var(--line);padding-right:8px}.ca-metric:last-child{border-right:0}.ca-metric-label{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;white-space:nowrap}.ca-metric-value{font:600 14px 'DM Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:7px;color:var(--ink)}.ca-metric-value.positive{color:var(--gain)}.ca-metric-value.negative{color:var(--loss)}.ca-note{display:flex;flex-wrap:wrap;gap:8px 18px;padding:10px 2px;color:var(--muted);font-size:9px;line-height:1.5}.ca-note b{color:var(--ink);font-family:'DM Mono',monospace;font-weight:500}.ca-side{position:sticky;top:14px}.ca-side-title{display:flex;justify-content:space-between;align-items:center;margin:2px 0 9px}.ca-side-title h2{font-size:11px;text-transform:uppercase;letter-spacing:.12em;margin:0}.ca-count{font:10px 'DM Mono',monospace;color:var(--muted)}.ca-strategy-list{border:1px solid var(--line);border-radius:14px;background:var(--surface);overflow:hidden;box-shadow:var(--shadow)}.ca-strategy-row{width:100%;display:flex;text-align:left;align-items:center;gap:9px;padding:12px 10px;border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--ink);cursor:pointer;transition:background .18s}.ca-strategy-row:last-child{border-bottom:0}.ca-strategy-row:hover{background:var(--surface2)}.ca-strategy-row.selected{background:var(--accent-soft);box-shadow:inset 3px 0 var(--accent)}.ca-row-num{width:26px;height:26px;display:grid;place-items:center;border-radius:8px;background:var(--surface2);color:var(--accent);font:600 9px 'DM Mono',monospace;flex:none}.ca-row-copy{min-width:0;flex:1}.ca-row-magic{font:600 11px 'DM Mono',monospace}.ca-row-sub{font-size:9px;color:var(--muted);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ca-row-value{text-align:right;font:600 10px 'DM Mono',monospace;white-space:nowrap}.ca-order{display:flex;flex-direction:column;gap:1px;opacity:.55}.ca-order button{border:0;background:transparent;color:var(--muted);padding:0;cursor:pointer;height:13px}.ca-order button:hover{color:var(--accent)}.ca-side-hint{padding:10px 3px;color:var(--muted);font-size:9px;line-height:1.5}.ca-detail{margin-top:13px;border:1px solid var(--line);border-radius:13px;background:var(--surface);overflow:hidden}.ca-detail-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:transparent;border:0;color:var(--ink);font:600 11px 'DM Sans',sans-serif;text-align:left;cursor:pointer}.ca-detail-toggle:hover{background:var(--surface2)}.ca-detail-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-top:1px solid var(--line)}.ca-detail-item{padding:12px;border-right:1px solid var(--line)}.ca-detail-item:last-child{border:0}.ca-detail-item small{display:block;font-size:9px;color:var(--muted)}.ca-detail-item b{display:block;margin-top:6px;font:500 12px 'DM Mono',monospace}.ca-control-panels{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:15px}.ca-panel{border:1px solid var(--line);border-radius:13px;background:var(--surface);overflow:hidden}.ca-panel summary{cursor:pointer;list-style:none;padding:13px 15px;font-size:11px;font-weight:700;display:flex;justify-content:space-between;align-items:center}.ca-panel summary::-webkit-details-marker{display:none}.ca-panel-content{border-top:1px solid var(--line);padding:13px 15px;font-size:10px;line-height:1.6;color:var(--muted)}.ca-reenable{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0}.ca-reenable b{color:var(--ink);font:500 10px 'DM Mono',monospace}.ca-inline{border:0;border-radius:6px;padding:6px 9px;background:var(--accent-soft);color:var(--accent);font:600 9px 'DM Sans',sans-serif;cursor:pointer}.ca-webhook{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ca-code{font:10px 'DM Mono',monospace;color:var(--accent);background:var(--surface2);padding:7px 9px;border-radius:6px}.ca-settings{position:relative}.ca-popover{position:absolute;right:0;top:43px;z-index:5;width:226px;padding:13px;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:var(--shadow)}.ca-pop-head{display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:700}.ca-popover p{color:var(--muted);font-size:9px;margin:5px 0 10px}.ca-switch{border:0;border-radius:99px;width:34px;height:19px;background:var(--line);padding:2px;cursor:pointer}.ca-switch.on{background:var(--accent)}.ca-switch span{display:block;width:15px;height:15px;border-radius:50%;background:var(--surface);transition:transform .18s}.ca-switch.on span{transform:translateX(15px)}.ca-interval{display:flex;flex-direction:column;gap:3px}.ca-interval button{border:0;background:transparent;color:var(--ink);text-align:left;padding:7px 8px;border-radius:6px;font:10px 'DM Sans',sans-serif;display:flex;justify-content:space-between;cursor:pointer}.ca-interval button:hover,.ca-interval button.active{background:var(--surface2);color:var(--accent)}.ca-notice{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:10;display:flex;align-items:center;gap:14px;max-width:calc(100vw - 28px);padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);box-shadow:var(--shadow);font-size:11px}.ca-notice button{border:0;background:transparent;color:var(--muted);cursor:pointer;padding:2px}.ca-footer{margin-top:18px;color:var(--muted);font-size:9px;text-align:center}.ca-empty{height:100%;display:grid;place-items:center;color:var(--muted);font-size:11px;border:1px dashed var(--line);border-radius:10px}.ca-root button:disabled{opacity:.3;cursor:not-allowed}
      @media(max-width:980px){.ca-layout{grid-template-columns:minmax(0,1fr) 218px;gap:13px}.ca-metric-strip{grid-template-columns:repeat(4,1fr)}.ca-metric:nth-child(4){border-right:0}.ca-metric:nth-child(n+5){padding-top:8px;border-top:1px solid var(--line)}}
      @media(max-width:720px){.ca-root{padding:16px 13px 35px}.ca-topline{align-items:flex-start}.ca-title{font-size:19px}.ca-actions{justify-content:flex-end;max-width:155px}.ca-btn{padding:8px}.ca-btn span{display:none}.ca-sample{align-items:flex-start;flex-direction:column;gap:5px;margin:12px 0 17px}.ca-sample-right{white-space:normal}.ca-layout{display:flex;flex-direction:column-reverse;gap:14px}.ca-maincol,.ca-side{width:100%}.ca-side{position:static}.ca-strategy-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.ca-strategy-row{padding:10px 7px;gap:6px}.ca-row-value{font-size:9px}.ca-order{display:none}.ca-hero{padding:16px 13px 13px}.ca-hero-top{gap:8px}.ca-hero-stat{max-width:42%}.ca-chart{height:224px;margin-left:-7px;margin-right:-7px}.ca-metric-strip{grid-template-columns:repeat(2,minmax(0,1fr));padding:11px;gap:0}.ca-metric{padding:8px 7px;border-right:1px solid var(--line);border-top:1px solid var(--line)}.ca-metric:nth-child(odd){border-right:1px solid var(--line)}.ca-metric:nth-child(1),.ca-metric:nth-child(2){border-top:0}.ca-metric:nth-child(even){border-right:0}.ca-metric-label{font-size:8px}.ca-metric-value{font-size:13px;margin-top:5px}.ca-detail-grid{grid-template-columns:repeat(2,1fr)}.ca-detail-item{border-bottom:1px solid var(--line)}.ca-detail-item:nth-child(even){border-right:0}.ca-detail-item:last-child{grid-column:span 2;border-bottom:0}.ca-control-panels{grid-template-columns:1fr}.ca-chart-caption{margin-top:17px}.ca-chart-caption span{max-width:240px}.ca-chart-legend{font-size:9px}}
      @media(prefers-reduced-motion:reduce){.ca-root *{transition:none!important}}
    `}</style>
    <style>{`
      .ca-row-magic,.ca-row-sub{display:block}
      .ca-row-magic{white-space:nowrap}
      @media(max-width:720px){.ca-actions .ca-btn span{display:none}}
    `}</style>
    <div className="ca-wrap">
      <header className="ca-topline">
        <div className="ca-brand">
          <div className="ca-brand-mark"><Activity size={20}/></div>
          <div><div className="ca-kicker">MT5 / private analytics</div><h1 className="ca-title">Realized performance</h1></div>
        </div>
        <div className="ca-actions">
          <button className="ca-btn" type="button" onClick={() => setNotice('Showing the local sample fixture; no refresh request was sent.')}><RefreshCw size={13}/><span>Refresh</span></button>
          <div className="ca-settings">
            <button className="ca-btn ca-square" type="button" aria-label="Dashboard settings" aria-expanded={settings} onClick={() => setSettings(!settings)}><Settings2 size={15}/></button>
            {settings && <div className="ca-popover">
              <div className="ca-pop-head">Auto-refresh <button className={`ca-switch ${autoRefresh ? 'on' : ''}`} role="switch" aria-checked={autoRefresh} onClick={() => setAutoRefresh(!autoRefresh)}><span/></button></div>
              <p>Preview only · no network polling</p>
              <div className="ca-interval">{intervals.map((item) => <button key={item} type="button" className={item === interval ? 'active' : ''} onClick={() => { setInterval(item); setSettings(false); }}>{item}{item === interval && <Check size={12}/>}</button>)}</div>
            </div>}
          </div>
          <button className="ca-btn danger" type="button" onClick={() => setNotice('Clear all trades is disabled in this local sample preview.')} aria-label="Clear all trades"><Trash2 size={13}/><span>Clear</span></button>
          <button className="ca-btn ca-square" type="button" aria-label="Export dashboard PDF" onClick={() => window.print()}><Printer size={14}/></button>
          <button className="ca-btn ca-square" type="button" aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'} onClick={() => setLight(!light)}>{light ? <Moon size={14}/> : <Sun size={14}/>}</button>
        </div>
      </header>

      <div className="ca-sample" role="note">
        <span><b>LOCAL SAMPLE</b> · illustrative MT5 metrics only — no backend or account data</span>
        <span className="ca-sample-right">5 active · 2 paused · {fixture.totals.tradeCount} closed trades</span>
      </div>

      <div className="ca-layout">
        <section className="ca-maincol" aria-label="Selected strategy realized equity">
          <div className="ca-hero">
            <div className="ca-hero-top">
              <div>
                <div className="ca-focus-label"><TrendingUp size={13}/> Strategy in focus</div>
                <h2 className="ca-strategy-title">Magic number <span style={{ color: 'var(--accent)' }}>{selected.magicNumber}</span></h2>
                <div className="ca-symbols">{selected.symbols.length ? selected.symbols.map((symbol) => <span className="ca-chip" key={symbol}>{symbol}</span>) : <span className="ca-chip">No ticker data</span>}</div>
              </div>
              <div className="ca-hero-stat">
                <div className={`ca-hero-net ${selected.netProfit < 0 ? 'negative' : ''}`} style={selected.netProfit < 0 ? { color: 'var(--loss)' } : undefined}>{money(selected.netProfit)}</div>
                <small>Realized net profit · USD</small>
              </div>
            </div>
            <div className="ca-chart-caption">
              <div><strong>Cumulative net profit</strong><span>Closed trades over time · USD · {points.length} trade closes</span></div>
              <div className="ca-chart-legend">●&nbsp; Magic {selected.magicNumber}</div>
            </div>
            <div className="ca-chart" role="img" aria-label={`Magic number ${selected.magicNumber} cumulative realized net profit over close time`}>
              {points.length ? <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 14, right: 10, left: 4, bottom: 0 }}>
                  <defs><linearGradient id={`ca-fill-${selected.magicNumber}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={selected.netProfit >= 0 ? '#258866' : '#b85c50'} stopOpacity={.23}/><stop offset="100%" stopColor={selected.netProfit >= 0 ? '#258866' : '#b85c50'} stopOpacity={.015}/></linearGradient></defs>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="2 5" vertical={false}/>
                  <XAxis dataKey="closeTime" tickFormatter={stamp} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={28}/>
                  <YAxis tickFormatter={compactMoney} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={58}/>
                  <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="4 5" strokeOpacity={.6}/>
                  <Tooltip content={<ChartTooltip/>} cursor={{ stroke: 'var(--accent)', strokeDasharray: '3 4', strokeOpacity: .5 }}/>
                  <Area type="monotone" dataKey="cumulativeProfit" stroke={selected.netProfit >= 0 ? '#258866' : '#b85c50'} strokeWidth={2.5} fill={`url(#ca-fill-${selected.magicNumber})`} activeDot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false}/>
                </AreaChart>
              </ResponsiveContainer> : <div className="ca-empty">No closed-trade equity points for this strategy.</div>}
            </div>
          </div>

          <div className="ca-metric-strip" aria-label="Account-wide performance summary">
            {[
              { label: 'Account net profit', value: money(net), tone: net >= 0 ? 'positive' : 'negative' },
              { label: 'Avg net / trade', value: money(net / fixture.totals.tradeCount), tone: net >= 0 ? 'positive' : 'negative' },
              { label: 'Profit factor', value: ratio(fixture.totals.profitFactor, fixture.totals) },
              { label: 'Win rate', value: percent(fixture.totals.winRate) },
              { label: 'Max drawdown', value: money(fixture.totals.maxDrawdown), tone: 'negative' },
              { label: 'Strategies', value: String(fixture.totals.magicNumberCount) },
              { label: 'Closed trades', value: fixture.totals.tradeCount.toLocaleString() },
            ].map((item) => <div className="ca-metric" key={item.label}><div className="ca-metric-label">{item.label}</div><div className={`ca-metric-value ${item.tone ?? ''}`}>{item.value}</div></div>)}
          </div>
          <div className="ca-note">
            <span><WalletCards size={11} style={{ verticalAlign: '-2px', marginRight: 4 }}/>All strategies · {fixture.totals.wins} wins · {fixture.totals.losses} losses</span>
            <span>Net = realized profit + commission + swap</span>
            <span>Sharpe per trade, not annualized: <b>{fixture.totals.sharpeRatio?.toFixed(2) ?? '—'}</b></span>
            <span>Payout ratio: <b>{fixture.totals.payoutRatio == null ? '—' : `${fixture.totals.payoutRatio.toFixed(2)}×`}</b></span>
          </div>

          <section className="ca-detail" aria-label="Selected strategy details">
            <button className="ca-detail-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
              <span>{expanded ? 'Hide' : 'Show'} full details · Magic {selected.magicNumber}</span>{expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
            {expanded && <div className="ca-detail-grid">
              {[
                ['Max drawdown', money(selected.maxDrawdown)],
                ['Avg net / trade', money(selected.netProfit / selected.tradeCount)],
                ['Sharpe ratio', selected.sharpeRatio == null ? '—' : selected.sharpeRatio.toFixed(2)],
                ['Payout ratio', selected.payoutRatio == null ? '—' : `${selected.payoutRatio.toFixed(2)}×`],
                ['Wins / losses / BE', `${selected.wins} / ${selected.losses} / ${selected.breakeven}`],
              ].map(([label, value]) => <div className="ca-detail-item" key={label}><small>{label}</small><b>{value}</b></div>)}
            </div>}
          </section>

          <div className="ca-control-panels">
            <details className="ca-panel" open={pausedOpen} onToggle={(event) => setPausedOpen(event.currentTarget.open)}>
              <summary><span>Paused magic numbers · {fixture.pausedMagicNumbers.length}</span><ChevronDown size={14}/></summary>
              {pausedOpen && <div className="ca-panel-content">
                New MT5 trades for these numbers are ignored. Re-enabling starts collecting again; deleted history will not return.
                {fixture.pausedMagicNumbers.map((magic) => <div className="ca-reenable" key={magic}><b>Magic #{magic}</b><button className="ca-inline" type="button" onClick={() => setNotice(`Re-enable for magic number ${magic} is disabled in this local sample.`)}>Re-enable</button></div>)}
              </div>}
            </details>
            <details className="ca-panel" open={webhookOpen} onToggle={(event) => setWebhookOpen(event.currentTarget.open)}>
              <summary><span>MT5 webhook setup <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· reference</span></span><ChevronDown size={14}/></summary>
              {webhookOpen && <div className="ca-panel-content">
                Preview only · this dashboard sends no requests.
                <div className="ca-webhook" style={{ marginTop: 8 }}><span className="ca-code">POST /api/trades</span><button type="button" className="ca-inline" onClick={copyWebhook}>{copied ? 'Copied' : 'Copy URL'}</button></div>
                <div style={{ marginTop: 9 }}>Send closed-trade records from your MT5 Expert Advisor. Net performance includes realized profit, commission, and swap.</div>
              </div>}
            </details>
          </div>
        </section>

        <aside className="ca-side" aria-label="Strategy selector">
          <div className="ca-side-title"><h2>Compare strategies</h2><span className="ca-count">{strategies.length} / {fixture.totals.magicNumberCount}</span></div>
          <div className="ca-strategy-list">
            {strategies.map((strategy, index) => <div key={strategy.magicNumber} style={{ display: 'flex', alignItems: 'stretch' }}>
              <button type="button" className={`ca-strategy-row ${selectedMagic === strategy.magicNumber ? 'selected' : ''}`} onClick={() => { setSelectedMagic(strategy.magicNumber); setExpanded(false); }} aria-pressed={selectedMagic === strategy.magicNumber} style={{ flex: 1 }}>
                <span className="ca-row-num"><Activity size={13}/></span>
                <span className="ca-row-copy"><span className="ca-row-magic">Magic {strategy.magicNumber}</span><span className="ca-row-sub">{strategy.symbols.join(' · ') || 'No ticker data'}</span></span>
                <span className={`ca-row-value ${strategy.netProfit >= 0 ? 'positive' : 'negative'}`} style={{ color: strategy.netProfit >= 0 ? 'var(--gain)' : 'var(--loss)' }}>{money(strategy.netProfit)}</span>
              </button>
              <span className="ca-order" aria-label={`Reorder magic ${strategy.magicNumber}`}>
                <button type="button" aria-label={`Move magic ${strategy.magicNumber} up`} disabled={index === 0} onClick={() => moveStrategy(strategy.magicNumber, -1)}><ChevronUp size={12}/></button>
                <button type="button" aria-label={`Move magic ${strategy.magicNumber} down`} disabled={index === strategies.length - 1} onClick={() => moveStrategy(strategy.magicNumber, 1)}><ChevronDown size={12}/></button>
              </span>
            </div>)}
          </div>
          <p className="ca-side-hint"><GripVertical size={11} style={{ verticalAlign: '-2px', marginRight: 4 }}/>Select a magic number to examine its realized equity. Use arrows to reorder.</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="ca-btn" type="button" aria-label={`Export magic ${selected.magicNumber} equity CSV`} onClick={() => exportCsv(selected)}><Download size={12}/><span>Equity CSV</span></button>
            <button className="ca-btn danger" type="button" aria-label={`Pause or delete history for magic ${selected.magicNumber}`} onClick={() => setNotice(`Pause and delete history for magic ${selected.magicNumber} are disabled in this local sample.`)}><Trash2 size={12}/><span>Pause / delete</span></button>
          </div>
          <div className="ca-side-hint"><Clock3 size={11} style={{ verticalAlign: '-2px', marginRight: 4 }}/>Sample updated {new Date(fixture.latestTradeAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{autoRefresh ? ` · preview ${interval}` : ''}</div>
        </aside>
      </div>
      <div className="ca-footer">Illustrative local sample · Net profit includes realized profit, commission and swap · Sharpe is per-trade and not annualized</div>
    </div>
    {notice && <div className="ca-notice" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={13}/></button></div>}
  </main>;
}