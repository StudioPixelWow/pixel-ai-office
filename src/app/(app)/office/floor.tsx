'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { he, ago } from '@/lib/format';
import { DEPARTMENTS } from '@/agents/roster';
import { ActionForm } from '@/components/client';

type A = any;
export function OfficeFloor({ board, avatars, clients, readyCaps }: { board: A[]; avatars: Record<string, string | null>; clients: { id: string; name: string }[]; readyCaps: string[] }) {
  const [dept, setDept] = useState(''); const [client, setClient] = useState(''); const [sel, setSel] = useState<A | null>(null); const [view, setView] = useState<'floor' | 'list'>('floor');
  const shown = useMemo(() => board.filter((a) => (!dept || a.department === dept) && (!client || a.current?.client_id === client)), [board, dept, client]);
  const state = (a: A) => a.current?.status ?? 'available';
  const unwired = (a: A) => (a.required_capabilities ?? []).some((c: string) => !readyCaps.includes(c));
  return <>
    <div className="hero"><div className="row"><div className="sp"><h1>המשרד <span className="mark">הווירטואלי</span></h1>
      <p>מצב כל סוכן נגזר ממנוע המשימות — לא מאנימציה. {board.filter((a) => state(a) === 'running').length} עובדים עכשיו · {board.filter((a) => state(a) === 'waiting_approval').length} ממתינים לך</p></div>
      <select aria-label="מחלקה" value={dept} onChange={(e) => setDept(e.target.value)} style={{ width: 180 }}><option value="">כל המחלקות</option>{Object.entries(DEPARTMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select aria-label="לקוח" value={client} onChange={(e) => setClient(e.target.value)} style={{ width: 180 }}><option value="">כל הלקוחות</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <button className="btn k" onClick={() => setView(view === 'floor' ? 'list' : 'floor')}>{view === 'floor' ? 'מבט רשימה נגיש' : 'מבט משרד'}</button></div></div>
    {view === 'list' ? <div className="tablewrap"><table className="t"><thead><tr><th>#</th><th>סוכן</th><th>תפקיד</th><th>מצב</th><th>משימה נוכחית</th><th>לקוח</th><th>עדכון</th></tr></thead>
      <tbody>{shown.map((a) => <tr key={a.id}><td>{a.number}</td><td><button className="btn ghost sm" onClick={() => setSel(a)}>{a.name}</button></td><td>{a.role_title}</td>
        <td><span className="badge">{he(state(a))}</span>{unwired(a) && <span className="badge muted">לא חובר</span>}</td><td>{a.current?.title ?? '—'}</td><td>{a.current?.client ?? '—'}</td><td>{ago(a.current?.updated_at)}</td></tr>)}</tbody></table></div>
    : <div className="office">{Object.entries(DEPARTMENTS).filter(([k]) => !dept || k === dept).map(([k, v]) => {
      const list = shown.filter((a) => a.department === k); if (!list.length) return null;
      return <section className="dept" key={k} aria-label={v}><h3>{v} <span className="badge muted">{list.length}</span></h3><div className="desks">
        {list.map((a) => <button key={a.id} className={`desk s-${state(a)} ${unwired(a) ? 'unwired' : ''}`} onClick={() => setSel(a)} aria-label={`${a.name}, ${a.role_title}, ${he(state(a))}`}>
          <div className="av">{avatars[a.id] ? <img src={`/api/avatar/${avatars[a.id]}`} alt="" loading="lazy" /> : a.name[0]}</div>
          <div className="nm">{a.name}</div><div className="rl">{a.role_title}</div>
          <span className="badge">{he(state(a))}</span><div className="tb" aria-hidden /></button>)}</div></section>; })}</div>}
    {sel && <div className="drawer" role="dialog" aria-label={sel.name}>
      <div className="row"><div className="av" style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-3)' }}>{avatars[sel.id] && <img src={`/api/avatar/${avatars[sel.id]}`} alt="" style={{ width: '100%' }} />}</div>
        <div className="sp"><h2>{sel.name}</h2><div className="muted">{sel.role_title} · גרסה {sel.version}</div></div><button className="btn ghost sm" onClick={() => setSel(null)}>סגירה</button></div>
      <dl className="kv" style={{ marginTop: 14 }}>
        <dt>מצב</dt><dd>{he(state(sel))}</dd><dt>משימה נוכחית</dt><dd>{sel.current ? <Link href={`/tasks/${sel.current.task_id}`}>{sel.current.title}</Link> : '—'}</dd>
        <dt>לקוח / פרויקט</dt><dd>{sel.current?.client ?? '—'}</dd><dt>שלב עבודה</dt><dd>{sel.current?.stage ?? '—'}</dd>
        <dt>פעולה אחרונה</dt><dd>{sel.current?.last_action ?? '—'}</dd><dt>עדכון</dt><dd>{ago(sel.current?.updated_at)}</dd>
        <dt>חסמים</dt><dd>{sel.current?.blocker ?? '—'}</dd><dt>תוצרים</dt><dd>{(sel.current?.artifacts ?? sel.last_done?.artifacts ?? []).map((id: string) => <Link key={id} href={`/studio/${id}`} className="badge cyan">תוצר</Link>)}</dd>
        <dt>עלות ריצה</dt><dd>{sel.current?.cost ? `$${Number(sel.current.cost).toFixed(3)}` : 'אין נתון מדווח'}</dd>
        <dt>יכולות נדרשות</dt><dd>{(sel.required_capabilities ?? []).map((c: string) => <span key={c} className={`badge ${readyCaps.includes(c) ? 'ok' : 'warn'}`}>{c}{readyCaps.includes(c) ? '' : ' · לא חובר'}</span>)}</dd>
        <dt>סיכום</dt><dd className="small">{Object.entries(sel.counts ?? {}).map(([s, n]) => `${he(s)}: ${n}`).join(' · ') || 'טרם עבד'}</dd>
      </dl>
      <h3 style={{ marginTop: 18 }}>תן משימה ל{sel.name}</h3>
      <ActionForm action="assign_task" extra={{ agent_id: sel.id, idempotency_key: `assign:${sel.id}:${Date.now()}` }} submit="פתח משימה"
        fields={[{ name: 'client_id', label: 'לקוח (ריק = הקשר כללי של Pixel)', type: 'select', options: clients.map((c) => [c.id, c.name]) },
          { name: 'instruction', label: 'המשימה', type: 'textarea', required: true }]} redirectTo="/talk?r={request_id}" />
      <p className="small"><Link href={`/agents/${sel.id}`}>כרטיס הסוכן המלא ←</Link></p></div>}
  </>;
}
