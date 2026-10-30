'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';
const F: [string, string, string, boolean?][] = [['need', 'הצורך המרכזי', 'מה הלקוח צריך מאיתנו'], ['goals', 'מטרות', 'יעדים עסקיים ושיווקיים', true], ['audiences', 'קהלי יעד', 'מי הלקוחות שלו', true],
  ['differentiators', 'בידול', 'מה מבדל אותו מהמתחרים', true], ['competitors', 'מתחרים', 'שמות / אתרים'], ['voice', 'שפה וטון', 'איך הוא מדבר'], ['constraints', 'אילוצים', 'מה אסור / רגישויות'], ['references', 'רפרנסים', 'השראה ודוגמאות']];
export function ProfileForm({ c }: { c: any }) {
  const r = useRouter(); const p = c.profile ?? {}; const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries([...F.map(([k]) => [k, typeof p[k] === 'string' ? p[k] : p[k] ? JSON.stringify(p[k]) : '']), ['website', p.website ?? ''], ['industry', c.industry ?? ''], ['status', c.status]]));
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [edit, setEdit] = useState(false);
  async function save() {
    setBusy(true); setMsg(null);
    try { const profile: any = Object.fromEntries(F.map(([k]) => [k, v[k]?.trim() || null])); let w = v.website.trim(); if (w && !/^https?:\/\//.test(w)) w = `https://${w}`; profile.website = w || null;
      await callAction('update_client', { id: c.id, version: c.version, status: v.status, industry: v.industry || null, profile }); setMsg({ ok: true, t: 'נשמר ✓' }); setEdit(false); r.refresh(); }
    catch (e) { setMsg({ ok: false, t: heError(e) }); } finally { setBusy(false); }
  }
  const filled = F.filter(([k]) => v[k]).length;
  return <div className="card prof">
    <div className="row"><h2 style={{ margin: 0 }}>פרופיל הלקוח</h2><span className="badge cyan">{filled}/{F.length} שדות</span><span className="sp" />{!edit && <button className="btn sm" onClick={() => setEdit(true)}>✎ עריכה</button>}</div>
    {!edit ? <dl className="kv" style={{ marginTop: 12 }}>
      <dt>אתר</dt><dd>{v.website ? <a href={v.website} target="_blank" rel="noreferrer" dir="ltr">{v.website.replace(/^https?:\/\//, '')}</a> : <span className="muted">חסר</span>}</dd>
      <dt>תחום</dt><dd>{v.industry || <span className="muted">חסר</span>}</dd>
      {F.map(([k, l]) => <><dt key={k + 't'}>{l}</dt><dd key={k}>{v[k] || <button className="linkish" onClick={() => setEdit(true)}>＋ להוסיף</button>}</dd></>)}</dl>
      : <form className="f" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="prof-2"><label>אתר<input value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} dir="ltr" placeholder="www.example.co.il" /></label>
          <label>תחום<input value={v.industry} onChange={(e) => setV({ ...v, industry: e.target.value })} /></label>
          <label>סטטוס<select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}><option value="onboarding">בהקמה</option><option value="active">פעיל</option><option value="paused">מושהה</option><option value="ended">הסתיים</option></select></label></div>
        {F.map(([k, l, hint, long]) => <label key={k}>{l}<span className="hint">{hint}</span>{long ? <textarea rows={2} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /> : <input value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}</label>)}
        <div className="row"><button className="btn y" disabled={busy}>{busy ? '…' : 'שמירה'}</button><button type="button" className="btn ghost" onClick={() => setEdit(false)}>ביטול</button></div></form>}
    {msg && <p className="small" style={{ color: msg.ok ? 'var(--ok)' : 'var(--bad)' }}>{msg.t}</p>}
  </div>;
}
