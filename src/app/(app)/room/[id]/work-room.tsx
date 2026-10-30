'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LiveRefresh } from '@/components/client';

type T = { id: string; title: string; step: string; agent: string | null; status: string; stage?: string | null; last_action?: string | null; blocker?: string | null; depends_on: string[];
  started_at?: string | null; finished_at?: string | null; created_at: string; outputs?: any; artifacts: string[]; attempts: number; kind?: string };
type A = { id: string; name: string; role: string; avatar?: string | null; department?: string };
const ST: Record<string, [string, string]> = { queued: ['בתור', 'q'], retrying: ['מנסה שוב', 'run'], running: ['עובד', 'run'], waiting_approval: ['ממתין לאישורך', 'ap'], waiting_input: ['צריך מידע', 'blk'],
  waiting_connection: ['ממתין לחיבור', 'blk'], waiting_local: ['ממתין למחשב', 'blk'], failed: ['נכשל', 'bad'], uncertain: ['לא ודאי', 'bad'], done: ['סיים', 'ok'], cancelled: ['בוטל', 'q'] };
const RANK: Record<string, number> = { running: 0, retrying: 1, waiting_approval: 2, waiting_input: 3, waiting_connection: 3, waiting_local: 3, failed: 4, uncertain: 4, queued: 5, done: 6, cancelled: 7 };
const t = (d?: string | null) => d ? new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(d)) : '';
const dur = (a?: string | null, b?: string | null) => { if (!a) return ''; const s = Math.max(0, Math.round(((b ? +new Date(b) : Date.now()) - +new Date(a)) / 1000)); return s < 60 ? `${s} שנ׳` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} דק׳`; };

export function WorkRoom({ request, tasks, agents, events, artifacts, usage }: { request: any; tasks: T[]; agents: Record<string, A>; events: any[]; artifacts: Record<string, any>; usage: any[] }) {
  const [, tick] = useState(0); useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  // one seat per participating agent; seat state = its most active task
  const seats = useMemo(() => {
    const by = new Map<string, T[]>(); for (const x of tasks) { const k = x.agent ?? 'system'; by.set(k, [...(by.get(k) ?? []), x]); }
    return [...by.entries()].map(([id, ts]) => ({ id, agent: agents[id] ?? { id, name: id === 'system' ? 'מערכת' : id, role: '' }, tasks: ts.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      cur: [...ts].sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9))[0] }))
      .sort((a, b) => a.tasks[0].created_at.localeCompare(b.tasks[0].created_at));
  }, [tasks, agents]);
  const [sel, setSel] = useState<string | null>(null);
  const active = seats.find((s) => s.id === sel) ?? seats.find((s) => s.cur.status === 'running') ?? seats[0];
  const done = tasks.filter((x) => x.status === 'done').length; const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const n = seats.length; const pos = (i: number) => { const a = -Math.PI / 2 + (i / Math.max(n, 1)) * Math.PI * 2; return { x: 50 + 41 * Math.cos(a), y: 50 + 38 * Math.sin(a) }; };
  const seatOf = new Map<string, number>(); seats.forEach((s, i) => s.tasks.forEach((x) => seatOf.set(x.id, i)));
  const links = tasks.flatMap((x) => x.depends_on.map((d) => [seatOf.get(d), seatOf.get(x.id), x.status] as const)).filter(([a, b]) => a !== undefined && b !== undefined && a !== b);
  const evFor = (s: typeof active) => events.filter((e) => s && (s.tasks.some((x) => x.id === e.task) || e.agent === s.id)).slice(0, 40);
  const cost = (ids: string[]) => usage.filter((u) => ids.includes(u.task)).reduce((a, u) => a + (Number(u.cost) || 0), 0);
  return <div className="room">
    <LiveRefresh />
    <div className="room-head"><div className="sp"><small>חדר עבודה</small><h1>{request.text}</h1>
      <div className="small">{done}/{tasks.length} שלבים · {seats.length} סוכנים סביב השולחן · נפתח {t(request.created_at)}</div></div>
      {request.research && request.client_id && <Link className={`btn ${pct === 100 ? 'y' : 'ghost room-ghost'}`} href={`/clients/${request.client_id}?tab=knowledge`}>{pct === 100 ? 'לתיק המותג המלא ←' : 'תיק הלקוח בבנייה ←'}</Link>}
      <div className="room-pct" style={{ ['--p' as any]: `${pct * 3.6}deg` }}><b>{pct}%</b></div></div>
    {request.research && request.client_id && pct === 100 && <div className="room-done"><b>המחקר הושלם ✓</b><span>תיק המותג, ספריית התוכן ובנק הנכסים מוכנים לצפייה ולאישור שלך.</span>
      <Link className="btn y sm" href={`/clients/${request.client_id}?tab=knowledge`}>תיק מותג ומחקר</Link><Link className="btn sm" href={`/clients/${request.client_id}?tab=assets`}>בנק נכסים</Link></div>}

    <div className="room-table-wrap">
      <svg className="room-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {links.map(([a, b, st], k) => { const p = pos(a!), q = pos(b!); return <line key={k} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={`ln ${st === 'done' ? 'ok' : st === 'running' ? 'run' : ''}`} />; })}
      </svg>
      <div className="room-table"><div className="room-table-in"><small>המשימה</small><b>{request.text.length > 90 ? request.text.slice(0, 90) + '…' : request.text}</b>
        <span className={`badge ${request.status === 'done' ? 'ok' : 'cyan'}`}>{request.status === 'done' ? 'הושלם' : request.status === 'paused' ? 'מושהה' : 'בעבודה'}</span></div></div>
      {seats.map((s, i) => { const p = pos(i); const [label, tone] = ST[s.cur.status] ?? [s.cur.status, 'q'];
        return <button key={s.id} className={`seat ${tone} ${active?.id === s.id ? 'sel' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => setSel(s.id)} aria-label={`${s.agent.name} — ${label}`}>
          {(s.cur.status === 'running' || s.cur.status === 'retrying') && <span className="bubble">{s.cur.last_action || s.cur.stage || 'עובד…'}</span>}
          <span className="ring">{s.agent.avatar ? <img src={`/api/avatar/${s.agent.avatar}`} alt="" /> : <i>{s.agent.name[0]}</i>}</span>
          <b>{s.agent.name}</b><small>{label}{s.tasks.length > 1 ? ` · ${s.tasks.filter((x) => x.status === 'done').length}/${s.tasks.length}` : ''}</small></button>; })}
    </div>

    <div className="room-seats-mobile">{seats.map((s) => { const [label, tone] = ST[s.cur.status] ?? [s.cur.status, 'q'];
      return <button key={s.id} className={`seat-row ${tone} ${active?.id === s.id ? 'sel' : ''}`} onClick={() => setSel(s.id)}>
        <span className="ring">{s.agent.avatar ? <img src={`/api/avatar/${s.agent.avatar}`} alt="" /> : <i>{s.agent.name[0]}</i>}</span>
        <span className="sp"><b>{s.agent.name}</b><small>{s.cur.last_action || s.cur.stage || label}</small></span><span className={`badge ${tone === 'ok' ? 'ok' : tone === 'bad' ? 'bad' : tone === 'ap' ? 'yellow' : tone === 'run' ? 'cyan' : 'muted'}`}>{label}</span></button>; })}</div>

    {active && <div className="room-detail card">
      <div className="row"><span className="ring big">{active.agent.avatar ? <img src={`/api/avatar/${active.agent.avatar}`} alt="" /> : <i>{active.agent.name[0]}</i>}</span>
        <div className="sp"><h2>{active.agent.name} <span className="muted small">{active.agent.role}</span></h2>
          <div className="small">מה הוא עושה עבורנו: {active.tasks.map((x) => x.title.split(' · ').pop()).join(' · ')}</div></div>
        {cost(active.tasks.map((x) => x.id)) > 0 && <span className="small muted">עלות: ${cost(active.tasks.map((x) => x.id)).toFixed(3)}</span>}</div>
      <div className="grid g2" style={{ marginTop: 12 }}>
        <div><h3>המשימות שלו</h3>{active.tasks.map((x) => { const [label, tone] = ST[x.status] ?? [x.status, 'q'];
          return <div key={x.id} className={`room-task ${tone}`}><div className="row"><b className="sp">{x.title.split(' · ').pop()}</b><span className="small">{label}</span></div>
            <div className="small">{x.stage ?? ''}{x.last_action ? ` — ${x.last_action}` : ''}</div>
            {x.blocker && <div className="small" style={{ color: 'var(--bad)' }}>חסם: {x.blocker}</div>}
            <div className="small muted">{x.started_at ? `התחיל ${t(x.started_at)} · ${dur(x.started_at, x.finished_at)}` : 'ממתין לשלבים קודמים'}{x.attempts > 1 ? ` · ניסיון ${x.attempts}` : ''}</div>
            {x.outputs?.summary && <div className="small">✓ {x.outputs.summary}</div>}
            {x.artifacts.map((a) => artifacts[a] && <Link key={a} className="small" href={`/studio/${a}`}>📄 {artifacts[a].title}</Link>)}
            <Link className="small" href={`/tasks/${x.id}`}>פירוט מלא ←</Link></div>; })}</div>
        <div><h3>יומן חי</h3><ol className="room-log">{evFor(active).map((e) => <li key={e.id}><time>{t(e.at)}</time> {e.message ?? e.kind}</li>)}
          {!evFor(active).length && <li className="muted">אין עדיין פעולות</li>}</ol></div>
      </div></div>}
    {request.answer && <div className="card"><h3>תשובת המשרד</h3><pre className="out" style={{ whiteSpace: 'pre-wrap' }}>{request.answer}</pre></div>}
  </div>;
}
