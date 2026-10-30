'use client';
import { useEffect, useState } from 'react';
const HELP: Record<string, string> = {
  logo: 'קובץ וקטורי (AI/SVG/PDF) או PNG איכותי עם רקע שקוף',
  brand: 'חוברת מותג, פונטים, קודי צבע — מה שיש',
  photos: 'תמונות אמיתיות של העסק, הצוות, המוצרים או העבודות',
  access_meta: 'בניהול העסק במטא: הגדרות → שותפים → הוספה. אפשר גם לכתוב לנו ונשלח בקשת גישה. לא צריך לשלוח סיסמה.',
  access_google: 'נשלח אליכם הזמנה לגוגל אדס / אנליטיקס / פרופיל העסק — רק לאשר אותה. לא צריך לשלוח סיסמה.',
  access_site: 'משתמש עורך באתר (וורדפרס וכו׳) או פרטי חברת האחסון — נתאם בטלפון, לא כאן.',
};
const Q: [string, string][] = [['unique', 'מה מייחד אתכם מהמתחרים?'], ['audience', 'מי הלקוחות הכי טובים שלכם?'], ['competitors', 'מי 3 המתחרים העיקריים?'],
  ['goals', 'מה המטרה ל-3 החודשים הקרובים?'], ['tone', 'איך אתם רוצים להישמע? (רשמי, צעיר, הומוריסטי…)'], ['avoid', 'יש משהו שחשוב להימנע ממנו?'], ['dates', 'תאריכים או עונות חשובים בעסק?']];
// "בואו נתחיל" — onboarding checklist for a new client inside the portal.
export function PortalOnboarding({ t }: { t: string }) {
  const [s, setS] = useState<any>(null); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [q, setQ] = useState<Record<string, string>>({}); const [openQ, setOpenQ] = useState(false);
  const load = () => fetch(`/api/public/portal/${t}/onboarding`).then((r) => r.json()).then((j) => { if (!j.error) { setS(j); setQ(j.answers ?? {}); } }).catch(() => null);
  useEffect(() => { load(); }, [t]); // eslint-disable-line
  if (!s || s.pct >= 100) return null;
  const post = async (body: any) => { setBusy(body.key ?? 'q'); setErr('');
    const r = await fetch(`/api/public/portal/${t}/onboarding`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); setBusy('');
    if (!r.ok) setErr(j.error ?? 'שגיאה'); else { setS(j); if (body.op === 'answers') setOpenQ(false); } };
  const upload = (key: string, f: File) => { if (f.size > 10 * 1024 * 1024) { setErr('הקובץ גדול מדי (עד 10MB)'); return; }
    const rd = new FileReader(); rd.onload = () => post({ op: 'upload', key, mime: f.type || 'application/octet-stream', name: f.name, b64: String(rd.result).split(',')[1] }); rd.readAsDataURL(f); };
  return <section id="start" className="pt-sec pt-onb">
    <div className="pt-onb-h"><h2>בואו נתחיל 🚀</h2><span className="pt-onb-pct"><b>{s.pct}%</b> הושלם</span></div>
    <div className="pt-onb-bar"><i style={{ width: `${s.pct}%` }} /></div>
    <p className="small">כמה דברים קטנים שיעזרו לנו להתחיל לעבוד מהר ובדיוק. אפשר לעשות בשלבים.</p>
    <ol className="pt-onb-list">{s.steps.map((x: any) => <li key={x.key} className={x.done ? 'done' : ''}>
      <i>{x.done ? '✓' : ''}</i><div className="sp"><b>{x.label}</b><small>{x.key === 'questionnaire' ? '7 שאלות קצרות, בערך 3 דקות' : HELP[x.key]}</small>
        {x.files?.length > 0 && <small className="pt-onb-files">{x.files.map((f: any) => f.name).join(' · ')}</small>}</div>
      {x.key === 'questionnaire' ? <button className="btn sm" onClick={() => setOpenQ(!openQ)}>{x.done ? 'עריכה' : 'למילוי'}</button>
        : ['logo', 'brand', 'photos'].includes(x.key) ? <label className="btn sm">{busy === x.key ? 'מעלה…' : x.done ? 'הוספת קובץ' : 'העלאה'}<input type="file" hidden onChange={(e) => e.target.files?.[0] && upload(x.key, e.target.files[0])} /></label>
        : <button className="btn sm" disabled={busy === x.key} onClick={() => post({ op: 'mark', key: x.key, done: !x.done })}>{x.done ? 'בטל סימון' : 'בוצע ✓'}</button>}
    </li>)}</ol>
    {openQ && <form className="pt-onb-q" onSubmit={(e) => { e.preventDefault(); post({ op: 'answers', answers: q }); }}>
      {Q.map(([k, l]) => <label key={k}>{l}<textarea rows={2} value={q[k] ?? ''} onChange={(e) => setQ({ ...q, [k]: e.target.value })} /></label>)}
      <button className="btn y" disabled={busy === 'q'}>{busy === 'q' ? 'שומר…' : 'שמירה'}</button></form>}
    {err && <p className="small" style={{ color: '#ff8a8a' }}>{err}</p>}
  </section>;
}
