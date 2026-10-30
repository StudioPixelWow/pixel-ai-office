'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';

function useSources() { const [d, setD] = useState<any>(null); useEffect(() => { fetch('/api/data-sources').then((r) => r.json()).then(setD).catch(() => setD({ error: 'אין חיבור' })); }, []); return d; }
const list = (x: any) => (Array.isArray(x) ? x : []);

// Connections screen: status + connect buttons.
export function DataConnections() {
  const d = useSources();
  const row = (ok: boolean | null, title: string, sub: string, action?: React.ReactNode) => <li className={ok ? 'ok' : ok === false ? 'bad' : ''}><i>{ok ? '✓' : ok === false ? '!' : '…'}</i><div><b>{title}</b><small>{sub}</small></div>{action}</li>;
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  return <div className="card ds"><h2>פרסום ונתונים</h2>
    {q?.get('mt') === 'failed' && <p className="small" style={{ color: 'var(--bad)' }}>חיבור מטא נכשל{q.get('why') ? `: ${q.get('why')}` : ''}</p>}
    {q?.get('mt') === 'connected' && <p className="small" style={{ color: 'var(--ok)' }}>מטא חובר ✓</p>}
    <p className="small muted">קריאה בלבד — המערכת לא משנה קמפיינים ולא מוציאה כסף. הנתונים מזינים את הדוחות החודשיים ואת שומר התקציב.</p>
    {!d ? <p className="muted">בודק חיבורים…</p> : <ul className="ds-list">
      {row(d.meta?.configured ? (d.meta.check?.ok ?? false) : false, 'Meta Ads', d.meta?.configured ? (d.meta.check?.ok ? `מחובר · ${d.meta.check?.name ?? ''} · ${list(d.meta.accounts).length} חשבונות מודעות` : `החיבור לא עובד: ${d.meta.check?.error ?? ''} — התחבר מחדש`) : d.meta?.app ? 'התחבר עם המשתמש שמנהל את הפייסבוק (מאיה) — המערכת תראה את כל חשבונות המודעות שלו' : 'חסר מפתח האפליקציה (META_APP_SECRET) בוורסל',
        d.meta?.app ? <a className="btn sm y" href="/api/meta/connect">{d.meta?.configured ? 'חיבור מחדש' : 'חיבור מטא'}</a> : undefined)}
      {row(!!d.google?.connected, 'Google (Ads + Analytics)', d.google?.connected ? 'ההרשאה אושרה' : 'צריך לאשר גישה לחשבון Google עם ה-MCC', <a className="btn sm y" href="/api/google/connect?for=marketing">{d.google?.connected ? 'חיבור מחדש' : 'חיבור Google'}</a>)}
      {row(d.google?.connected ? !!d.google.ads_configured && !(d.google.ads as any)?.error : null, 'Google Ads דרך ה-MCC', !d.google?.ads_configured ? 'חסר GOOGLE_ADS_MCC_ID ב-Vercel' : (d.google.ads as any)?.error ? `שגיאה: ${(d.google.ads as any).error}` : `${list(d.google.ads).length} חשבונות לקוח תחת ה-MCC`)}
      {row(d.google?.connected ? !(d.google.ga4 as any)?.error : null, 'Google Analytics 4', !d.google?.connected ? 'אחרי חיבור Google' : (d.google.ga4 as any)?.error ? `שגיאה: ${(d.google.ga4 as any).error}` : `${list(d.google.ga4).length} נכסי GA4 נגישים`)}
    </ul>}
  </div>;
}

// Client page: map this client to its ad accounts / GA4 property.
export function ClientSources({ clientId, current }: { clientId: string; current: any }) {
  const d = useSources(); const r = useRouter(); const [v, setV] = useState<any>({ meta: current?.meta ?? '', google_ads: current?.google_ads ?? '', ga4: current?.ga4 ?? '', cpl_target: current?.cpl_target ?? '', monthly_budget: current?.monthly_budget ?? '' });
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); setMsg(null); try { const x = await callAction('client_sources_set', { client_id: clientId, ...v }); setMsg(x?.note ?? 'נשמר'); r.refresh(); } catch (e) { setMsg(heError(e)); } finally { setBusy(false); } };
  const sel = (k: string, label: string, opts: { id: string; name: string }[], ph: string) => <label>{label}{opts.length ? <select value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })}><option value="">— לא מחובר —</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.id}</option>)}</select>
    : <input dir="ltr" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder={ph} />}</label>;
  return <div className="card"><h2>מקורות נתונים ללקוח</h2>
    <p className="small muted">שייך את חשבונות הפרסום וה-Analytics של הלקוח — הנתונים יימשכו כל בוקר לדוח ולשומר התקציב.</p>
    <div className="f">
      {sel('meta', 'חשבון מודעות Meta', list(d?.meta?.accounts).map((a: any) => ({ id: a.id, name: a.name })), 'מזהה חשבון (מספרים)')}
      {sel('google_ads', 'חשבון Google Ads', list(d?.google?.ads).map((a: any) => ({ id: a.id, name: a.name })), 'Customer ID (123-456-7890)')}
      {sel('ga4', 'נכס GA4', list(d?.google?.ga4).map((a: any) => ({ id: a.id, name: `${a.name} (${a.account})` })), 'Property ID')}
      <div className="grid g2"><label>יעד עלות לליד (₪)<input type="number" value={v.cpl_target} onChange={(e) => setV({ ...v, cpl_target: e.target.value })} /></label>
        <label>תקציב מדיה חודשי (₪)<input type="number" value={v.monthly_budget} onChange={(e) => setV({ ...v, monthly_budget: e.target.value })} /></label></div>
      <button className="btn sm y" disabled={busy} onClick={save}>{busy ? '…' : 'שמירה'}</button>{msg && <span className="small">{msg}</span>}
    </div></div>;
}
