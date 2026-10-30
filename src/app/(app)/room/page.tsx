import Link from 'next/link';
import { safeList } from '@/lib/api';
import { ago } from '@/lib/format';
import { LiveRefresh } from './live-refresh';
export const dynamic = 'force-dynamic';

const ACTIVE = ['running', 'retrying', 'queued'];
const WAIT = ['waiting_approval', 'waiting_input', 'waiting_connection', 'waiting_local'];

// Meeting rooms index: every request is a meeting around a table; live ones first.
export default async function Rooms() {
  const reqs = await safeList<any>('requests', {}, 40);
  const [tasks, defs, cls] = await Promise.all([reqs.length ? safeList<any>('task_runs', { request_id: reqs.map((r) => r.id) }, 1000) : Promise.resolve([]), safeList<any>('agent_definitions', {}, 200), safeList<any>('clients', {}, 500)]);
  const testIds = new Set(cls.filter((c) => c.is_test || c.status === 'archived').map((c) => c.id));
  const ag = Object.fromEntries(defs.map((d) => [d.id, d]));
  const rooms = reqs.map((r) => {
    const ts = tasks.filter((t) => t.request_id === r.id); const agents = [...new Set(ts.map((t) => t.agent_id).filter(Boolean))] as string[];
    const done = ts.filter((t) => t.status === 'done').length; const live = ts.some((t) => ACTIVE.includes(t.status)); const wait = !live && ts.some((t) => WAIT.includes(t.status));
    const speaking = ts.filter((t) => ['running', 'retrying'].includes(t.status)).map((t) => ag[t.agent_id]?.name).filter(Boolean);
    const last = ts.map((t) => t.updated_at ?? t.created_at).sort().pop() ?? r.created_at;
    return { r, ts, agents, done, live, wait, speaking, last, pct: ts.length ? Math.round((done / ts.length) * 100) : 0 };
  }).filter((x) => x.ts.length && !x.ts.some((t) => t.client_id && testIds.has(t.client_id)));
  const live = rooms.filter((x) => x.live); const waiting = rooms.filter((x) => x.wait); const past = rooms.filter((x) => !x.live && !x.wait);
  const card = (x: (typeof rooms)[number]) => <Link key={x.r.id} href={`/room/${x.r.id}`} className={`mt-card ${x.live ? 'on' : x.wait ? 'wait' : ''}`}>
    <div className="mt-table"><div className="mt-seats">{x.agents.slice(0, 7).map((a, i) => <span key={a} className="cc-av sm" style={{ ['--i' as any]: i, ['--n' as any]: Math.min(x.agents.length, 7) }}>
      {ag[a]?.avatar_blob_id ? <img src={`/api/avatar/${ag[a].avatar_blob_id}`} alt="" /> : (ag[a]?.name ?? '•')[0]}</span>)}</div><b>{x.pct}%</b></div>
    <div className="mt-body"><b>{x.r.text?.length > 80 ? x.r.text.slice(0, 80) + '…' : x.r.text}</b>
      <small>{x.live ? (x.speaking.length ? `מדברים עכשיו: ${x.speaking.join(' · ')}` : 'בישיבה — הסוכן הבא נכנס') : x.wait ? 'ממתין לך כדי להמשיך' : 'הישיבה הסתיימה'}</small>
      <small className="muted">{x.agents.length} סוכנים · {x.done}/{x.ts.length} שלבים · {ago(x.last)}</small></div></Link>;
  return <>
    {live.length > 0 && <LiveRefresh ms={6000} />}
    <div className="hero"><h1>חדר <span className="mark">הישיבות</span></h1>
      <p>כל משימה היא ישיבה סביב שולחן: רואים מי יושב, מי מדבר עכשיו, את הפרוטוקול ואת מה שיצא. {live.length ? <><b>{live.length}</b> ישיבות פעילות עכשיו.</> : 'אין כרגע ישיבה פעילה.'}</p>
      <Link className="btn k" href="/talk">פתח ישיבה חדשה (תן משימה)</Link></div>
    {live.length > 0 && <section className="mt-sec"><h2><span className="cc-pulse" /> בישיבה עכשיו</h2><div className="mt-grid">{live.map(card)}</div></section>}
    {waiting.length > 0 && <section className="mt-sec"><h2>ממתינות לך</h2><div className="mt-grid">{waiting.map(card)}</div></section>}
    <section className="mt-sec"><h2>ישיבות אחרונות</h2>{past.length ? <div className="mt-grid">{past.map(card)}</div> : <p className="muted">עדיין אין ישיבות שהסתיימו.</p>}</section>
  </>;
}
