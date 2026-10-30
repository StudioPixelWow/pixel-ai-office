'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';

type S = { research: string; competitors?: string; gantt: string; gantt_day: string; rtm: string; rtm_days: string; clients: number; with_site: number; researched: number; with_dossier: number; social: number; missing_site: { id: string; name: string }[] };
const DOW = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳'];

// Autopilot: the agents start work on their own. Every switch is the owner's; costs are API usage per run.
export function AutopilotPanel({ s, canEdit }: { s: S; canEdit: boolean }) {
  const r = useRouter(); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [sites, setSites] = useState<Record<string, string>>({});
  const set = async (key: string, value: string) => { setBusy(key); setErr(''); try { await callAction('setting_set', { key, value }); r.refresh(); } catch (e: any) { setErr(e.message); } finally { setBusy(''); } };
  const saveSite = async (id: string) => { setBusy(id); setErr(''); try { await callAction('client_website_set', { client_id: id, website: sites[id] }); r.refresh(); } catch (e: any) { setErr(e.message); } finally { setBusy(''); } };
  const days = s.rtm_days.split(',').filter(Boolean);
  const Sw = ({ k, on }: { k: string; on: boolean }) => <button className={`ap-sw ${on ? 'on' : ''}`} disabled={!canEdit || busy === k} onClick={() => set(k, on ? 'off' : 'on')} aria-pressed={on}>{on ? 'פועל' : 'כבוי'}</button>;
  return <div className="card ap">
    <div className="ap-head"><div><h2>טייס אוטומטי — הסוכנים מתחילים לבד</h2>
      <p className="small muted">כל מתג הוא שלך. כל הרצה עולה לפי שימוש ב-API ומופיעה בעמוד העלויות. תוצרים עוברים אליך לאישור — שום דבר לא נשלח ללקוח בלי אישור.</p></div></div>
    <div className="ap-stats"><div><b>{s.clients}</b><small>לקוחות פעילים</small></div><div><b>{s.with_site}</b><small>עם אתר</small></div><div><b>{s.researched}</b><small>עברו מחקר</small></div><div><b>{s.with_dossier}</b><small>עם תיק מאושר</small></div></div>
    <div className="ap-rules">
      <div className="ap-rule"><div className="sp"><b>מחקר אוטומטי ללקוח חדש</b><small>כל לקוח פעיל שיש לו אתר ועוד לא נחקר — נכנס למחקר מלא (עד 3 בשעה). בערך 1–3$ ללקוח, פעם אחת.</small></div><Sw k="autopilot_research" on={s.research === 'on'} /></div>
      <div className="ap-rule"><div className="sp"><b>גאנט חודשי אוטומטי</b><small>מיד אחרי שאישרת את תיק המותג של לקוח סושיאל (גם מי שאושר קודם): גאנט נבנה לבד, לחודש הנוכחי עד ה-15 ואחרי זה לחודש הבא. מחכה לאישורך. בערך 0.3–0.7$ לגאנט.</small>
        <label className="ap-inline">מתחילים ביום <select value={s.gantt_day} disabled={!canEdit} onChange={(e) => set('autopilot_gantt_day', e.target.value)}>{[10, 15, 18, 20, 22, 25].map((d) => <option key={d} value={d}>{d}</option>)}</select> בחודש</label></div>
        <Sw k="autopilot_gantt" on={s.gantt === 'on'} /></div>
      <div className="ap-rule"><div className="sp"><b>סריקת RTM יומית</b><small>בכל בוקר (מ-08:00) לכל לקוח סושיאל עם תיק מאושר: אירוע אקטואלי רלוונטי + רעיון תגובה לאישורך. אם אין משהו רלוונטי — לא ממציא. בערך 0.05–0.15$ ללקוח ביום.</small>
        <span className="ap-days">{DOW.map((d, i) => { const on = days.includes(String(i)); return <button key={i} className={on ? 'on' : ''} disabled={!canEdit}
          onClick={() => set('autopilot_rtm_days', (on ? days.filter((x) => x !== String(i)) : [...days, String(i)]).sort().join(','))}>{d}</button>; })}</span></div>
        <Sw k="autopilot_rtm" on={s.rtm === 'on'} /></div>
      <div className="ap-rule"><div className="sp"><b>מעקב מתחרים שבועי</b><small>כל יום ראשון מ-09:00, לכל לקוח סושיאל/קמפיינים עם תיק מאושר: מה המתחרים פרסמו והציעו השבוע, עם מקורות, קישורים לספריית המודעות של מטא ו-3 רעיונות תגובה. בערך 0.1–0.3$ ללקוח בשבוע.</small></div>
        <Sw k="autopilot_competitors" on={s.competitors === 'on'} /></div>
    </div>
    {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
    {s.missing_site.length > 0 && <details className="ap-missing"><summary>{s.missing_site.length} לקוחות בלי אתר — בלי אתר לא מריצים מחקר (כדי לא לחקור חברה אחרת בטעות)</summary>
      <div className="ap-sites">{s.missing_site.map((c) => <div key={c.id} className="ap-site"><b>{c.name}</b>
        <input dir="ltr" placeholder="www.example.co.il" value={sites[c.id] ?? ''} onChange={(e) => setSites({ ...sites, [c.id]: e.target.value })} />
        <button className="btn sm y" disabled={!sites[c.id] || busy === c.id} onClick={() => saveSite(c.id)}>שמור</button></div>)}</div></details>}
  </div>;
}
