import Link from 'next/link';
const n = (v: any, d = 0) => v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('he-IL', { maximumFractionDigits: d });
const ils = (v: any) => v === null || v === undefined ? '—' : '₪' + n(v);
const delta = (a: any, b: any, goodUp = true) => { if (!a || !b || !Number(b)) return null; const p = Math.round(((Number(a) - Number(b)) / Number(b)) * 100); if (!p) return null; const good = goodUp ? p > 0 : p < 0; return <i className={`ad-d ${good ? 'up' : 'dn'}`}>{p > 0 ? '▲' : '▼'}{Math.abs(p)}%</i>; };
// One row per client: Meta, Google Ads, GA4. Accounts shared by two clients (e.g. one ad account for two brands) are counted once in the totals.
export function AdsTable({ rows, single }: { rows: any[]; single?: boolean }) {
  const seen = new Map<string, string>(); const shared = new Map<string, string>();
  for (const r of rows) for (const s of ['meta', 'google_ads'] as const) { const k = r.sources?.[s] ? `${s}:${r.sources[s]}` : ''; if (!k) continue; if (seen.has(k)) shared.set(`${r.id}:${s}`, seen.get(k)!); else seen.set(k, r.name); }
  const sum = (s: 'meta' | 'google_ads', f: string) => rows.reduce((a, r) => shared.has(`${r.id}:${s}`) ? a : a + (Number(r[s]?.[f]) || 0), 0);
  const tm = { spend: sum('meta', 'spend'), leads: sum('meta', 'leads'), conv: sum('meta', 'conversations') }; const tg = { spend: sum('google_ads', 'spend'), conv: sum('google_ads', 'conversions'), clicks: sum('google_ads', 'clicks') };
  if (!rows.length) return <p className="muted">אין עדיין לקוחות עם חשבון מטא/גוגל מחובר. מחברים בכרטיס הלקוח ← מקורות נתונים.</p>;
  return <>
    {!single && <div className="kpis ad-kpis">
      <div className="kpi"><small>הוצאה במטא</small><b>{ils(tm.spend)}</b><span>{n(tm.leads)} לידים · {n(tm.conv)} שיחות</span></div>
      <div className="kpi"><small>הוצאה בגוגל אדס</small><b>{ils(tg.spend)}</b><span>{n(tg.conv)} המרות · {n(tg.clicks)} קליקים</span></div>
      <div className="kpi"><small>סה״כ מדיה</small><b>{ils(tm.spend + tg.spend)}</b><span>{rows.length} לקוחות מחוברים</span></div></div>}
    <div className="ad-list">{rows.map((r) => { const m = r.meta, g = r.google_ads, a = r.ga4; const tgt = Number(r.sources?.cpl_target) || null; const bud = Number(r.sources?.monthly_budget) || null;
      const spend = (shared.has(`${r.id}:meta`) ? 0 : Number(m?.spend) || 0) + (shared.has(`${r.id}:google_ads`) ? 0 : Number(g?.spend) || 0);
      return <div key={r.id} className="card ad-row">
        {!single && <div className="ad-h"><Link href={`/clients/${r.id}`}><b>{r.name}</b></Link>{bud ? <span className={`badge ${spend > bud ? 'red' : 'muted'}`}>תקציב {ils(bud)} · נוצל {Math.round((spend / bud) * 100)}%</span> : null}</div>}
        <div className="ad-cols">
          <div className={`ad-src ${m ? '' : 'off'}`}><small>מטא{r.sources?.meta ? '' : ' · לא מחובר'}</small>{m ? <>
            <b>{ils(m.spend)} {delta(m.spend, r.prev_meta?.spend)}</b>
            <span>{n(m.leads)} לידים{m.cpl ? <> · עלות לליד <em className={tgt && m.cpl > tgt ? 'bad' : ''}>{ils(m.cpl)}</em></> : ''}</span>
            <span>{n(m.conversations)} שיחות · CTR {n(m.ctr, 2)}% · חשיפה {n(m.reach)}</span>
            {shared.has(`${r.id}:meta`) && <span className="small muted">חשבון משותף עם {shared.get(`${r.id}:meta`)}, לא נספר פעמיים</span>}</> : <span className="muted">{r.sources?.meta ? 'אין נתונים לחודש הזה' : '—'}</span>}</div>
          <div className={`ad-src ${g ? '' : 'off'}`}><small>גוגל אדס{r.sources?.google_ads ? '' : ' · לא מחובר'}</small>{g ? <>
            <b>{ils(g.spend)} {delta(g.spend, r.prev_google_ads?.spend)}</b>
            <span>{n(g.conversions, 1)} המרות{g.cpa ? <> · עלות להמרה <em className={tgt && g.cpa > tgt ? 'bad' : ''}>{ils(g.cpa)}</em></> : ''}</span>
            <span>{n(g.clicks)} קליקים · CTR {n(g.ctr, 2)}%</span>
            {shared.has(`${r.id}:google_ads`) && <span className="small muted">חשבון משותף עם {shared.get(`${r.id}:google_ads`)}, לא נספר פעמיים</span>}</> : <span className="muted">{r.sources?.google_ads ? 'אין נתונים לחודש הזה' : '—'}</span>}</div>
          <div className={`ad-src ${a ? '' : 'off'}`}><small>אנליטיקס (אתר)</small>{a ? <>
            <b>{n(a.users)} משתמשים</b>
            <span>{(a.channels ?? []).slice(0, 3).map((c: any) => `${c.channel} ${n(c.sessions)}`).join(' · ')}</span></> : <span className="muted">{r.sources?.ga4 ? 'אין נתונים לחודש הזה' : '—'}</span>}</div>
        </div></div>; })}</div>
  </>;
}
