'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';
import { TalkingReport } from '@/components/talking-report';

const FIELDS: [string, string][] = [['spend', 'הוצאה על מדיה (₪)'], ['leads', 'לידים'], ['impressions', 'חשיפות'], ['clicks', 'קליקים'], ['site_visits', 'כניסות לאתר'], ['followers_gain', 'עוקבים חדשים']];
const mLabel = (m: string) => new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m.slice(0, 7)}-01T12:00:00Z`));

export function ReportsPanel({ clientId, data }: { clientId: string; data: any }) {
  const r = useRouter(); const now = new Date(); const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const [month, setMonth] = useState(prev); const cur = data.metrics?.[`${month}:manual`] ?? {};
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map(([k]) => [k, cur[k] != null ? String(cur[k]) : ''])));
  const [busy, setBusy] = useState<string | null>(null); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const reports: any[] = data.reports ?? []; const rep = reports.find((x) => String(x.month).slice(0, 7) === month);
  const pick = (m: string) => { setMonth(m); const c = data.metrics?.[`${m}:manual`] ?? {}; setVals(Object.fromEntries(FIELDS.map(([k]) => [k, c[k] != null ? String(c[k]) : '']))); };
  const saveMetrics = async () => { setBusy('m'); setMsg(null); try {
      const d: Record<string, number> = {}; for (const [k] of FIELDS) if (vals[k] !== '' && !isNaN(Number(vals[k]))) d[k] = Number(vals[k]);
      if (d.spend && d.leads) d.cpl = Math.round((d.spend / d.leads) * 100) / 100; if (d.clicks && d.impressions) d.ctr = Math.round((d.clicks / d.impressions) * 10000) / 100;
      await callAction('metrics_save', { client_id: clientId, month: `${month}-01`, source: 'manual', data: d }); setMsg({ ok: true, t: 'הנתונים נשמרו' }); r.refresh(); } catch (e) { setMsg({ ok: false, t: heError(e) }); } finally { setBusy(null); } };
  const gen = async () => { setBusy('g'); setMsg(null);
    const j = await fetch(`/api/clients/${clientId}/report`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ month }) }).then((x) => x.json()).catch(() => ({ error: 'אין חיבור' }));
    setBusy(null); if (j.error) setMsg({ ok: false, t: j.error }); else { setMsg({ ok: true, t: 'הדוח מוכן — עבור עליו ושתף' }); r.refresh(); } };
  const voice = async () => { setBusy('v'); setMsg(null);
    const j = await fetch(`/api/clients/${clientId}/report/voice`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ month }) }).then((x) => x.json()).catch(() => ({ error: 'אין חיבור' }));
    setBusy(null); if (j.error) setMsg({ ok: false, t: j.error }); else { setMsg({ ok: true, t: 'הגרסה המדברת מוכנה — היא תופיע ללקוח בפורטל יחד עם הדוח' }); r.refresh(); } };
  const share = async () => { setBusy('s'); setMsg(null); try { const d = await callAction('report_share', { client_id: clientId, month: `${month}-01` }); setMsg({ ok: true, t: d?.note ?? 'שותף' }); r.refresh(); } catch (e) { setMsg({ ok: false, t: heError(e) }); } finally { setBusy(null); } };
  const months = Array.from({ length: 4 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  const s = rep?.summary;
  return <div className="grid g2">
    <div className="card"><h2>דוח ביצועים חודשי</h2>
      <div className="tabs" style={{ marginBottom: 12 }}>{months.map((m) => <a key={m} href="#" className={m === month ? 'on' : ''} onClick={(e) => { e.preventDefault(); pick(m); }}>{mLabel(m)}</a>)}</div>
      {s ? <div className="rp">
        <p className="rp-h">{s.headline}</p>
        {(s.numbers ?? []).length > 0 && <div className="rp-nums">{s.numbers.map((n: any, i: number) => <div key={i}><b>{n.value}</b><small>{n.label}</small></div>)}</div>}
        {(s.highlights ?? []).length > 0 && <><h3>הישגים</h3><ul>{s.highlights.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></>}
        {(s.insights ?? []).length > 0 && <><h3>תובנות</h3><ul>{s.insights.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></>}
        {(s.next_month ?? []).length > 0 && <><h3>בחודש הבא</h3><ul>{s.next_month.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></>}
        {rep.voice?.audio_blob && <TalkingReport src={`/api/files/${rep.voice.audio_blob}`} slides={rep.voice.slides ?? []} />}
        <div className="row"><button className="btn sm" disabled={!!busy} onClick={voice}>{busy === 'v' ? 'מקליט… (עד 2 דקות)' : rep.voice?.audio_blob ? '🎙 הקלט מחדש' : '🎙 צור דוח מדבר'}</button></div>
        <div className="row"><button className="btn y sm" disabled={!!busy} onClick={share}>{rep.status === 'shared' ? 'שלח שוב ללקוח' : 'שיתוף בפורטל + הודעה'}</button><button className="btn sm ghost" disabled={!!busy} onClick={gen}>{busy === 'g' ? 'כותב…' : 'כתוב מחדש'}</button>
          {rep.status === 'shared' && <span className="badge ok">בפורטל ✓</span>}</div>
      </div> : <div className="cc-empty"><b>עוד אין דוח ל{mLabel(month)}</b><p>המערכת אוספת לבד פוסטים שעלו, אבני דרך, פגישות ושביעות רצון. הוסף נתוני פרסום (או חבר Meta / Google) — וה-AI יכתוב דוח ברור ללקוח.</p>
        <button className="btn y sm" disabled={!!busy} onClick={gen}>{busy === 'g' ? 'כותב דוח… (עד דקה)' : '✦ כתוב דוח עם AI'}</button></div>}
      {msg && <p className="small" style={{ color: msg.ok ? 'var(--ok)' : 'var(--bad)' }}>{msg.t}</p>}
    </div>
    <div className="card"><h2>נתוני פרסום ותנועה · {mLabel(month)}</h2>
      <p className="small muted">עד שיחוברו Meta Ads, Google Ads ו-Analytics — מזינים כאן ידנית. עלות לליד ו-CTR מחושבים לבד.</p>
      <div className="f"><div className="grid g2">{FIELDS.map(([k, l]) => <label key={k}>{l}<input type="number" step="any" inputMode="decimal" value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /></label>)}</div>
        <button className="btn sm" disabled={!!busy} onClick={saveMetrics}>{busy === 'm' ? '…' : 'שמירת נתונים'}</button></div>
    </div>
  </div>;
}
