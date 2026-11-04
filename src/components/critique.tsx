'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
// Proposal reviewer: score + notes. Tal ticks the notes he wants, adds his own, and the proposal is rewritten into a new version and re-scored.
export function Critique({ id, initial }: { id: string; initial: any }) {
  const r = useRouter(); const [c, setC] = useState<any>(initial); const [busy, setBusy] = useState(''); const [err, setErr] = useState<string | null>(null); const [done, setDone] = useState<string | null>(null);
  const [fx, setFx] = useState<Set<number>>(() => new Set((initial?.fixes ?? []).map((_: any, i: number) => i)));
  const [rk, setRk] = useState<Set<number>>(new Set()); const [extra, setExtra] = useState('');
  const reset = (n: any) => { setC(n); setFx(new Set((n?.fixes ?? []).map((_: any, i: number) => i))); setRk(new Set()); setExtra(''); };
  const post = async (path: string, body?: any) => fetch(`/api/proposals/${id}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then((x) => x.json()).catch(() => ({ error: 'אין חיבור' }));
  const run = async () => { setBusy('check'); setErr(null); setDone(null); const j = await post('critique'); setBusy(''); if (j.error) setErr(j.error); else { reset(j.critique); r.refresh(); } };
  const apply = async () => { setBusy('apply'); setErr(null); setDone(null);
    const j = await post('revise', { fixes: [...fx], risks: [...rk], extra }); setBusy('');
    if (j.error) { setErr(j.error); return; }
    setDone(`נוצרה גרסה ${j.version}: ${j.summary ?? 'ההצעה עודכנה'}${j.critique ? ` · ציון ${j.prev_score ?? '—'} ← ${j.critique.score}` : ''}`);
    if (j.critique) reset(j.critique); r.refresh(); };
  const tog = (s: Set<number>, set: (x: Set<number>) => void, i: number) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); set(n); };
  const picked = fx.size + rk.size + (extra.trim() ? 1 : 0);
  return <div className="card crit"><div className="crit-h"><h2>מבקר ההצעות · מומוס</h2><button className="btn sm" disabled={!!busy} onClick={run}>{busy === 'check' ? 'בודק… (עד דקה)' : c ? 'בדיקה מחדש' : '✦ בדוק את ההצעה'}</button></div>
    {!c && !busy && <p className="small muted">לפני שליחה: בדיקה מול הצורך של הליד ומול הצעות שנסגרו ושלא נסגרו. לא משנה מחיר. אחרי הבדיקה תבחר אילו הערות ליישם, וההצעה תתעדכן לגרסה חדשה.</p>}
    {c && <><div className="crit-score"><b className={c.score >= 80 ? 'ok' : c.score >= 60 ? 'mid' : 'low'}>{c.score}</b><span>{c.verdict}{c.prev_score != null && c.prev_score !== c.score ? <small className="muted"> · לפני התיקון: {c.prev_score}</small> : null}</span></div>
      {(c.strengths ?? []).length > 0 && <><h3>חזק</h3><ul>{c.strengths.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></>}
      {(c.fixes ?? []).length > 0 && <><div className="crit-sel"><h3>תיקונים מוצעים · סמן מה ליישם</h3>
        <span><button type="button" className="btn sm ghost" onClick={() => setFx(new Set(c.fixes.map((_: any, i: number) => i)))}>סמן הכל</button><button type="button" className="btn sm ghost" onClick={() => setFx(new Set())}>נקה</button></span></div>
        {c.fixes.map((x: any, i: number) => <label key={i} className={`crit-fix pick ${fx.has(i) ? 'on' : ''}`}><input type="checkbox" checked={fx.has(i)} onChange={() => tog(fx, setFx, i)} />
          <div><small>{x.section}</small><p>{x.issue}</p><blockquote>{x.rewrite}</blockquote></div></label>)}</>}
      {(c.risks ?? []).length > 0 && <><h3>סיכונים · סמן אם לטפל בהם בהצעה</h3>{c.risks.map((x: string, i: number) => <label key={i} className={`crit-fix pick risk ${rk.has(i) ? 'on' : ''}`}><input type="checkbox" checked={rk.has(i)} onChange={() => tog(rk, setRk, i)} /><div><p>{x}</p></div></label>)}</>}
      <label className="crit-extra">הערה שלך לתיקון (לא חובה)<textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="למשל: להדגיש ניסיון בתחום, לקצר את הפתיח" /></label>
      <div className="crit-apply"><button className="btn y" disabled={!!busy || !picked} onClick={apply}>{busy === 'apply' ? 'מעדכן את ההצעה ובודק שוב… (עד 2 דק׳)' : `✦ עדכן את ההצעה לפי מה שבחרתי (${picked})`}</button>
        <small className="muted">נוצרת גרסה חדשה של ההצעה. המחיר ופרטי הלקוח לא משתנים, והגרסה החדשה צריכה את האישור שלך לפני שליחה.</small></div></>}
    {done && <p className="small" style={{ color: 'var(--ok)' }} role="status">✓ {done}</p>}
    {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}</div>;
}
