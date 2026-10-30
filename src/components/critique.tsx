'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function Critique({ id, initial }: { id: string; initial: any }) {
  const r = useRouter(); const [c, setC] = useState<any>(initial); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const run = async () => { setBusy(true); setErr(null); const j = await fetch(`/api/proposals/${id}/critique`, { method: 'POST' }).then((x) => x.json()).catch(() => ({ error: 'אין חיבור' })); setBusy(false); if (j.error) setErr(j.error); else { setC(j.critique); r.refresh(); } };
  return <div className="card crit"><div className="crit-h"><h2>מבקר ההצעות · מומוס</h2><button className="btn sm" disabled={busy} onClick={run}>{busy ? 'בודק… (עד דקה)' : c ? 'בדיקה מחדש' : '✦ בדוק את ההצעה'}</button></div>
    {!c && !busy && <p className="small muted">לפני שליחה: בדיקה מול הצורך של הליד ומול הצעות שנסגרו ושלא נסגרו. לא משנה מחיר — רק מעיר ומציע ניסוחים.</p>}
    {c && <><div className="crit-score"><b className={c.score >= 80 ? 'ok' : c.score >= 60 ? 'mid' : 'low'}>{c.score}</b><span>{c.verdict}</span></div>
      {(c.strengths ?? []).length > 0 && <><h3>חזק</h3><ul>{c.strengths.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></>}
      {(c.risks ?? []).length > 0 && <><h3>סיכונים</h3><ul>{c.risks.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></>}
      {(c.fixes ?? []).length > 0 && <><h3>תיקונים מוצעים</h3>{c.fixes.map((x: any, i: number) => <div key={i} className="crit-fix"><small>{x.section}</small><p>{x.issue}</p><blockquote>{x.rewrite}</blockquote></div>)}</>}</>}
    {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}</div>;
}
