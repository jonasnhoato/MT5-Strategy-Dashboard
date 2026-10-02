import {useMemo, useState, type ReactNode} from 'react';
import {ArrowRight, ChevronUp, ChevronDown, Download, GripVertical, Pause, Trash2} from 'lucide-react';
import {CSVLink} from 'react-csv';
import type {StrategyPerformance} from '@workspace/api-client-react';
type StrategyUnit = StrategyPerformance;
const money = (value:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const percent = (value:number) => `${value.toFixed(1)}%`;
const metricNumber = (value:number|null|undefined) => value == null || !Number.isFinite(value) ? '—' : value.toFixed(2);
const profitFactor = (value:number|null,item:Pick<StrategyPerformance,'losses'|'netProfit'>) => value != null && Number.isFinite(value) ? value.toFixed(2) : item.losses === 0 && item.netProfit > 0 ? '∞' : '—';
const dateShort = (value:string) => new Date(value).toLocaleDateString('en-US',{month:'short',day:'numeric'});
const equityCsvHeaders = [{label:'close_time',key:'closeTime'},{label:'trade_net_profit',key:'netProfit'},{label:'cumulative_net_profit',key:'cumulativeProfit'}];
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


export function StrategyBoardTile({ strategy, index, count, onMove, onDropReorder, onPause, pausePending, chart, onDragStart, onDragEnd, onDragOver, isDragging, isDropTarget }: {
  strategy: StrategyUnit;
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
  onDropReorder: (source: number, target: number) => void;
  onPause: () => void;
  pausePending: boolean;
  chart: ReactNode;
  onDragStart: (magicNumber: number) => void;
  onDragEnd: () => void;
  onDragOver: (magicNumber: number) => void;
  isDragging: boolean;
  isDropTarget: boolean;
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
    className={`sb-unit ${isDragging ? 'sb-dragging' : ''} ${isDropTarget ? 'sb-drop-target' : ''}`}
    data-testid={`strategy-${strategy.magicNumber}`}
    draggable
    onDragStart={(event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(strategy.magicNumber));
      onDragStart(strategy.magicNumber);
    }}
    onDragEnd={onDragEnd}
    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (!isDropTarget) onDragOver(strategy.magicNumber); }}
    onDrop={(event) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData('text/plain');
      const source = Number(raw);
      if (raw && Number.isSafeInteger(source) && source !== strategy.magicNumber) onDropReorder(source, strategy.magicNumber);
      onDragEnd();
    }}
  >
    <header className="sb-unit-head">
      <span className="sb-unit-index">{String(index + 1).padStart(2, '0')}</span>
      <div className="sb-unit-identity">
        <div className="sb-id-line"><span className="sb-overline">EXPERT ADVISOR</span><span className="sb-status"><i />Active</span></div>
        <h3>Magic <b>{strategy.magicNumber}</b></h3>
        <div className="sb-symbols" aria-label={`Traded symbols for magic number ${strategy.magicNumber}`}>
          {strategy.symbols.length ? strategy.symbols.map((symbol) => <span key={symbol}>{symbol}</span>) : <span className="sb-no-symbols">No ticker data</span>}
        </div>
      </div>
      <div className="sb-unit-tools">
        <span className="sb-drag-handle" title="Drag to reorder" aria-hidden="true" data-testid={`button-drag-strategy-${strategy.magicNumber}`}><GripVertical size={15} /></span>
        <div className="sb-reorder">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move magic number ${strategy.magicNumber} up`} data-testid={`button-move-strategy-up-${strategy.magicNumber}`}><ChevronUp size={13} /></button>
          <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move magic number ${strategy.magicNumber} down`} data-testid={`button-move-strategy-down-${strategy.magicNumber}`}><ChevronDown size={13} /></button>
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
          {chart}
        </div>
        <div className="sb-detail-actions">
          {strategy.equity.length > 0 && <CSVLink data={strategy.equity} headers={equityCsvHeaders} filename={`magic-${strategy.magicNumber}-net-profit-equity.csv`} data-testid={`export-csv-${strategy.magicNumber}`} aria-label={`Export magic number ${strategy.magicNumber} equity as CSV`}><Download size={13} /> Export equity CSV</CSVLink>}
          <button type="button" className="sb-danger-action" disabled={pausePending} onClick={onPause}><Trash2 size={13} /> Pause and delete history</button>
        </div>
      </>}
    </div>
    <footer className="sb-unit-foot">
      <button type="button" onClick={onPause} disabled={pausePending} className="sb-pause-button" data-testid={`button-delete-strategy-${strategy.magicNumber}`} aria-label={`Stop monitoring and delete history for magic number ${strategy.magicNumber}`}>
        <Pause size={13} />Pause monitoring
      </button>
      <span className="sb-breakeven">{strategy.breakeven} breakeven</span>
    </footer>
  </article>;
}

