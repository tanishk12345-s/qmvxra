import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Download, ExternalLink, RefreshCw, Wind, Zap } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const fmt = (v, digits=0) => v == null ? '—' : Number(v).toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const shortTime = (v) => new Date(v).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });

function Metric({ label, value, unit, hint, icon: Icon, tone='blue' }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={18}/></span></div><div className="metric-value">{value}<small>{unit}</small></div><div className="metric-hint">{hint}</div></article>;
}
function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cutoff, setCutoff] = useState('12');
  const [selectedDay, setSelectedDay] = useState('all');
  const [lastUpdated, setLastUpdated] = useState(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API}/api/analysis?start=2026-01-01&end=2026-01-31&cutoff_hour=${cutoff}`);
      if (!response.ok) {
        let message = `API returned ${response.status}`;
        try { message = (await response.json()).detail || message; } catch {}
        throw new Error(message);
      }
      setData(await response.json()); setLastUpdated(new Date());
    } catch (e) {
      setError(`${e.message}. Start the Python API and check connectivity to Elexon.`);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [cutoff]);
  const days = useMemo(() => {
    if (!data?.points) return [];
    return [...new Set(data.points.map(p => p.startTime.slice(0,10)))];
  }, [data]);
  const visible = useMemo(() => selectedDay === 'all' ? (data?.points || []) : (data?.points || []).filter(p => p.startTime.slice(0,10) === selectedDay), [data, selectedDay]);
  const chartData = useMemo(() => visible.map(p => ({ ...p, label: shortTime(p.startTime) })), [visible]);
  const s = data?.summary;
  function exportCsv() {
    if (!visible.length) return;
    const cols = ['startTime','forecast','actual','error','absoluteError','publishTime'];
    const csv = [cols.join(','), ...visible.map(p => cols.map(c => `"${String(p[c] ?? '').replaceAll('"','""')}"`).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
    const a = document.createElement('a'); a.href=url; a.download='wind-forecast-january-2026.csv'; a.click(); URL.revokeObjectURL(url);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Wind size={23}/></div><div><strong>Northstar</strong><span>ENERGY INTELLIGENCE</span></div></div>
      <div className="nav-label">WORKSPACE</div>
      <div className="nav-item active"><Activity size={17}/> Forecast overview</div>
      <div className="nav-item"><CalendarDays size={17}/> Delivery analysis <span className="nav-tag">JAN</span></div>
      <div className="nav-label source-label">DATA SOURCES</div>
      <div className="source-row"><span className="source-dot green"></span><div><strong>Elexon BMRS</strong><small>Wind actuals · FUELHH</small></div><CheckCircle2 size={15} className="source-check"/></div>
      <div className="source-row"><span className="source-dot violet"></span><div><strong>Elexon BMRS</strong><small>Wind forecast · WINDFOR</small></div><CheckCircle2 size={15} className="source-check"/></div>
      <div className="sidebar-bottom"><div className="status-pill"><span></span> Pilot environment</div><small>UK National · 30-minute periods</small><small>Data: Elexon BMRS API</small></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="breadcrumb">Analytics <span>/</span> Wind generation</div><div className="top-actions"><span className="live-indicator"><span></span> API-connected view</span><div className="avatar">UK</div></div></header>
      <section className="page-heading"><div><div className="eyebrow">DAY-AHEAD PROCUREMENT / PILOT</div><h1>Wind forecast intelligence</h1><p>Understand forecast uncertainty before committing to the wholesale market.</p></div><div className="heading-actions"><label className="cutoff-select"><Clock3 size={15}/><span>Decision cut-off</span><select value={cutoff} onChange={e=>setCutoff(e.target.value)}><option value="10">10:00 UK</option><option value="12">12:00 UK</option><option value="16">16:00 UK</option></select></label><button className="button secondary" onClick={load} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/> Refresh</button><button className="button primary" onClick={exportCsv} disabled={!visible.length}><Download size={15}/> Export CSV</button></div></section>

      <div className="period-banner"><div className="period-icon"><CalendarDays size={19}/></div><div><strong>Historical review · January 2026</strong><span>National wind generation · Actuals matched to the latest forecast available by the selected day-ahead cut-off</span></div><div className="period-right"><span className="period-label">DELIVERY WINDOW</span><strong>01 Jan — 31 Jan 2026</strong></div></div>

      {error && <div className="error-box"><strong>Could not load live data</strong><span>{error}</span><small>For local development, run the backend on port 8000. The dashboard intentionally avoids presenting fabricated sample metrics.</small></div>}
      {loading && !data && <div className="loading-state"><div className="loader"></div><strong>Loading Elexon data</strong><span>Fetching actual generation and forecast publication history…</span></div>}

      <section className="section-heading"><div><h2>Performance at a glance</h2><p>Metrics are calculated only from matched half-hourly periods.</p></div><span className="muted-label">{s ? `${fmt(s.delivery_periods)} MATCHED PERIODS` : 'WAITING FOR DATA'}</span></section>
      <div className="metrics-grid">
        <Metric label="Mean absolute error" value={fmt(s?.mae_mw,1)} unit="MW" hint="Typical absolute miss per period" icon={Activity} tone="blue"/>
        <Metric label="Root mean square error" value={fmt(s?.rmse_mw,1)} unit="MW" hint="Penalises larger forecast misses" icon={Zap} tone="orange"/>
        <Metric label="Mean forecast bias" value={s?.mean_bias_mw == null ? '—' : `${s.mean_bias_mw > 0 ? '+' : ''}${fmt(s.mean_bias_mw,1)}`} unit="MW" hint={s?.mean_bias_mw == null ? 'Forecast minus actual' : s.mean_bias_mw > 0 ? 'Net over-forecast' : s.mean_bias_mw < 0 ? 'Net under-forecast' : 'No average directional bias'} icon={s?.mean_bias_mw > 0 ? ArrowUpRight : ArrowDownRight} tone="violet"/>
        <Metric label="Forecast coverage" value={fmt(s?.forecast_coverage_pct,1)} unit="%" hint="Actual periods with eligible forecast" icon={CheckCircle2} tone="green"/>
      </div>

      <section className="chart-card"><div className="card-heading"><div><h2>Forecast vs actual generation</h2><p>Half-hourly wind output, measured in megawatts (MW)</p></div><div className="chart-controls"><select value={selectedDay} onChange={e=>setSelectedDay(e.target.value)}><option value="all">All January</option>{days.map(d=><option key={d} value={d}>{new Date(d+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</option>)}</select><span className="legend-dot forecast"></span><span className="legend-text">Forecast</span><span className="legend-dot actual"></span><span className="legend-text">Actual</span></div></div>
        {chartData.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:10,right:16,left:0,bottom:4}}><defs><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c75ee" stopOpacity={0.18}/><stop offset="100%" stopColor="#7c75ee" stopOpacity={0.01}/></linearGradient></defs><CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e9edf3"/><XAxis dataKey="label" tick={{fontSize:11,fill:'#7a8597'}} minTickGap={50} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#7a8597'}} axisLine={false} tickLine={false} width={52} tickFormatter={v=>`${(v/1000).toFixed(1)}k`}/><Tooltip labelStyle={{color:'#152238',fontWeight:700}} formatter={(v,n)=>[`${fmt(v,1)} MW`,n==='forecast'?'Forecast':'Actual']} contentStyle={{border:'1px solid #e5e9f0',borderRadius:10,boxShadow:'0 8px 24px #10203a12'}}/><Area type="monotone" dataKey="forecast" name="forecast" stroke="#7c75ee" strokeWidth={2} fill="url(#forecastFill)" dot={false}/><Line type="monotone" dataKey="actual" name="actual" stroke="#1ba783" strokeWidth={2} dot={false} activeDot={{r:4}}/></AreaChart></ResponsiveContainer></div> : <div className="empty-chart"><div className="empty-icon"><Activity size={23}/></div><strong>{loading ? 'Updating analysis…' : 'Forecast comparison will appear here'}</strong><span>{error ? 'The API has not returned data yet.' : 'Matched January 2026 periods will be plotted once data is available.'}</span></div>}
        <div className="chart-footer"><span><span className="tiny-dot"></span> Data source: Elexon BMRS</span><span>All timestamps displayed in UK local time</span></div>
      </section>

      <div className="lower-grid">
        <section className="chart-card error-card"><div className="card-heading"><div><h2>Forecast error profile</h2><p>Forecast − actual · positive values indicate over-forecasting</p></div></div>{chartData.length ? <div className="small-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e9edf3"/><XAxis dataKey="label" tick={{fontSize:10,fill:'#7a8597'}} minTickGap={45} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10,fill:'#7a8597'}} axisLine={false} tickLine={false} width={48}/><Tooltip formatter={v=>[`${fmt(v,1)} MW`,'Forecast error']}/><Line type="monotone" dataKey="error" stroke="#e5a044" strokeWidth={1.8} dot={false}/></LineChart></ResponsiveContainer></div>:<div className="empty-small">Error trend appears when matched data is available.</div>}</section>
        <section className="insight-card"><div className="insight-top"><div className="insight-icon"><Zap size={18}/></div><span className="eyebrow">HOW TO READ THIS</span></div><h2>Turn forecast error into a better buying decision.</h2><p>Wind forecast uncertainty changes how much flexible generation or market power a team may need to procure. Use these metrics to understand the scale and direction of forecast misses—not as a standalone trading recommendation.</p><div className="insight-rule"></div><div className="insight-stat"><span>Bias interpretation</span><strong>{s?.mean_bias_mw == null ? 'Awaiting data' : s.mean_bias_mw > 0 ? 'Over-forecasting' : s.mean_bias_mw < 0 ? 'Under-forecasting' : 'Balanced on average'}</strong></div><div className="insight-stat"><span>Latest forecast publication</span><strong>{s?.latest_publication ? shortTime(s.latest_publication) : 'Not available'}</strong></div></section>
      </div>

      <section className="table-card"><div className="card-heading"><div><h2>Delivery-period detail</h2><p>Audit the forecast selected for each half-hour settlement period.</p></div><span className="table-count">{fmt(visible.length)} rows</span></div><div className="table-scroll"><table><thead><tr><th>DELIVERY TIME (UK)</th><th>FORECAST (MW)</th><th>ACTUAL (MW)</th><th>ERROR (MW)</th><th>ABS. ERROR</th><th>FORECAST PUBLISHED</th></tr></thead><tbody>{visible.slice(0,100).map((p,i)=><tr key={p.startTime}><td className="time-cell">{shortTime(p.startTime)}</td><td>{fmt(p.forecast,1)}</td><td>{fmt(p.actual,1)}</td><td className={p.error>0?'positive':p.error<0?'negative':''}>{p.error>0?'+':''}{fmt(p.error,1)}</td><td>{fmt(p.absoluteError,1)}</td><td className="publish-cell">{shortTime(p.publishTime)}</td></tr>)}</tbody></table>{visible.length===0&&<div className="table-empty">No rows to display. Start the API or adjust the selected date.</div>}</div>{visible.length>100&&<div className="table-foot">Showing the first 100 of {visible.length} rows. Export CSV for the complete selected dataset.</div>}</section>

      <footer className="footer"><div><span className="footer-brand"><Wind size={15}/> Northstar <span>ENERGY INTELLIGENCE</span></span><span className="footer-divider">·</span><span>Built for day-ahead decision support</span></div><div className="footer-links"><a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream" target="_blank" rel="noreferrer">FUELHH docs <ExternalLink size={12}/></a><a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream" target="_blank" rel="noreferrer">WINDFOR docs <ExternalLink size={12}/></a></div></footer>
      {lastUpdated && <div className="updated-note">Last refreshed {lastUpdated.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>}
    </main>
  </div>;
}
export default App;
