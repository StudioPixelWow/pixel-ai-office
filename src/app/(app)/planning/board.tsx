'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, Plus, CalendarDays, Flag, FolderKanban, ListChecks, AlertTriangle } from 'lucide-react';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';

const STAGES: [string, string, string][] = [['planning', 'בתכנון', 'st-plan'], ['active', 'בעבודה', 'st-act'], ['waiting_client', 'ממתין ללקוח', 'st-wait'], ['review', 'בבדיקה / לאישור', 'st-rev'], ['on_hold', 'מוקפא', 'st-hold'], ['done', 'הושלם', 'st-done']];
const TZ = 'Asia/Jerusalem';
const dkey = (x: string | Date) => new Date(x).toLocaleDateString('en-CA', { timeZone: TZ });
const dd = (x?: string | null) => x ? new Date(x).toLocaleDateString('he-IL', { timeZone: TZ, day: '2-digit', month: '2-digit' }) : '';

// One place for all the work: every client's projects by stage, and every open task grouped by when it's due.
export function WorkBoard({ d }: { d: any }) {
  const r = useRouter(); const [view, setView] = useState<'tasks' | 'projects'>('tasks'); const [client, setClient] = useState(''); const [who, setWho] = useState('');
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const [t, setT] = useState({ title: '', due: '', client_id: '' });
  const team: any[] = d.team ?? []; const name = (id: string) => team.find((x) => x.id === id)?.name;
  const todos: any[] = (d.todos ?? []).filter((x: any) => (!client || x.client_id === client) && (!who || x.assignee === who));
  const projects: any[] = (d.projects ?? []).filter((x: any) => !client || x.client_id === client);
  const today = dkey(new Date()); const in7 = dkey(new Date(Date.now() + 7 * 864e5));
  const groups = useMemo(() => {
    const open = todos.filter((x) => x.status === 'open'); const g: [string, string, any[]][] = [
      ['late', 'באיחור', open.filter((x) => x.due_at && dkey(x.due_at) < today)], ['today', 'היום', open.filter((x) => x.due_at && dkey(x.due_at) === today)],
      ['week', 'השבוע', open.filter((x) => x.due_at && dkey(x.due_at) > today && dkey(x.due_at) <= in7)], ['later', 'בהמשך', open.filter((x) => x.due_at && dkey(x.due_at) > in7)],
      ['none', 'בלי תאריך', open.filter((x) => !x.due_at)], ['done', 'בוצעו ב-7 הימים האחרונים', todos.filter((x) => x.status === 'done')]];
    return g;
  }, [todos, today, in7]);
  const run = async (a: string, p: any) => { setBusy(p.id ?? a); setMsg(''); try { await callAction(a, p); r.refresh(); } catch (e) { setMsg(heError(e)); } finally { setBusy(''); } };
  const add = async (e: any) => { e.preventDefault(); if (!t.title.trim()) return;
    await run('todo_save', { title: t.title, due_at: t.due ? new Date(`${t.due}T09:00:00+03:00`).toISOString() : null, all_day: false, client_id: t.client_id || client || null, priority: 'normal' }); setT({ title: '', due: '', client_id: '' }); };
  const lateN = groups[0][2].length, todayN = groups[1][2].length;
  return <>
    <div className="hero"><h1>פרויקטים <span className="mark">ומשימות</span></h1><p>כל העבודה הפתוחה של המשרד במקום אחד: משימות לפי מועד, ופרויקטים של כל הלקוחות לפי סטטוס. לחיצה על פרויקט פותחת אותו בכרטיס הלקוח.</p></div>
    <div className="kpis wb-kpis">
      <div className="kpi"><small>באיחור</small><b className={lateN ? 'bad' : ''}>{lateN}</b></div>
      <div className="kpi"><small>להיום</small><b>{todayN}</b></div>
      <div className="kpi"><small>משימות פתוחות</small><b>{todos.filter((x) => x.status === 'open').length}</b></div>
      <div className="kpi"><small>פרויקטים פעילים</small><b>{projects.filter((p) => !['done', 'on_hold'].includes(p.stage)).length}</b></div></div>
    <div className="acc-bar wb-bar">
      <div className="tabs" style={{ margin: 0 }}><button className={view === 'tasks' ? 'on' : ''} onClick={() => setView('tasks')}><ListChecks size={16} /> משימות</button><button className={view === 'projects' ? 'on' : ''} onClick={() => setView('projects')}><FolderKanban size={16} /> פרויקטים</button></div>
      <select value={client} onChange={(e) => setClient(e.target.value)} aria-label="לקוח"><option value="">כל הלקוחות</option>{(d.clients ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      {view === 'tasks' && team.length > 1 && <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="אחראי"><option value="">כל הצוות</option>{team.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
    </div>
    {msg && <p className="small acc-msg">{msg}</p>}
    {view === 'tasks' ? <>
      <form className="card wb-add" onSubmit={add}><Plus size={18} /><input value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder="משימה חדשה… (Enter לשמירה)" aria-label="משימה חדשה" />
        <input type="date" value={t.due} onChange={(e) => setT({ ...t, due: e.target.value })} aria-label="מועד" />
        {!client && <select value={t.client_id} onChange={(e) => setT({ ...t, client_id: e.target.value })} aria-label="לקוח"><option value="">בלי לקוח</option>{(d.clients ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        <button className="btn y sm" disabled={!t.title.trim() || !!busy}>הוספה</button></form>
      {groups.filter(([, , xs]) => xs.length).map(([k, l, xs]) => <section key={k} className={`wb-g ${k}`}><h3>{k === 'late' && <AlertTriangle size={17} />}{l} <span>{xs.length}</span></h3>
        <ul className="wb-list">{xs.map((x) => <li key={x.id} className={`${x.status === 'done' ? 'done' : ''} ${x.priority === 'high' ? 'hi' : ''}`}>
          <button className="wb-chk" disabled={busy === x.id} aria-label={x.status === 'done' ? 'החזר לפתוחה' : 'סמן כבוצעה'} onClick={() => run(x.project_id ? 'project_task_set' : 'todo_set', x.project_id ? { project_id: x.project_id, id: x.id, status: x.status === 'done' ? 'open' : 'done' } : { id: x.id, status: x.status === 'done' ? 'open' : 'done' })}>{x.status === 'done' ? <CheckCircle2 size={21} /> : <Circle size={21} />}</button>
          <span className="sp wb-t"><b>{x.title}</b><small>{x.client ? <Link href={`/clients/${x.client_id}${x.project_id ? '?tab=projects' : ''}`}>{x.client}</Link> : 'כללי'}{x.project ? ` · ${x.project}` : ''}{x.assignee && name(x.assignee) ? ` · ${name(x.assignee)}` : ''}</small></span>
          {x.priority === 'high' && <span className="pj-due late"><Flag size={13} /> דחוף</span>}
          {x.due_at && <span className={`pj-due ${k === 'late' ? 'late' : ''}`}><CalendarDays size={13} /> {dd(x.due_at)}</span>}</li>)}</ul></section>)}
      {!todos.length && <p className="muted">אין משימות פתוחות. 🎉</p>}
    </> : <div className="wb-kanban">{STAGES.map(([k, l, c]) => { const xs = projects.filter((p) => p.stage === k); return <section key={k} className="wb-col"><h3><span className={`pj-st ${c}`}>{l}</span> <span className="muted">{xs.length}</span></h3>
      {xs.map((p) => { const tot = p.open + p.done; const late = p.due_date && k !== 'done' && p.due_date < today;
        return <Link key={p.id} href={`/clients/${p.client_id}?tab=projects`} className="card wb-pj"><b>{p.name}</b><small>{p.client}</small>
          <div className="wb-pj-m">{p.due_date && <span className={`pj-due ${late ? 'late' : ''}`}><CalendarDays size={13} /> {dd(p.due_date)}</span>}{p.late > 0 && <span className="pj-due late"><AlertTriangle size={13} /> {p.late} באיחור</span>}{p.priority === 'high' && <span className="pj-due late"><Flag size={13} /></span>}</div>
          <div className="wb-pj-p"><span className="pj-prog"><i style={{ width: `${tot ? Math.round((p.done / tot) * 100) : 0}%` }} /></span><small>{tot ? `${p.done}/${tot}` : 'אין משימות'}</small></div></Link>; })}
      {!xs.length && <p className="small muted wb-empty">—</p>}</section>; })}</div>}
  </>;
}
