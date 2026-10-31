'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderKanban, Building2, Megaphone, Sparkles, Plus, CalendarDays, Flag, CheckCircle2, Circle, MessageSquareText, ListChecks, ExternalLink, Pencil, Archive, Clock } from 'lucide-react';
import { callAction, Modal } from '@/components/client';
import { heError } from '@/lib/errors';

export const STAGES: [string, string, string][] = [['planning', 'בתכנון', 'st-plan'], ['active', 'בעבודה', 'st-act'], ['waiting_client', 'ממתין ללקוח', 'st-wait'], ['review', 'בבדיקה / לאישור', 'st-rev'], ['on_hold', 'מוקפא', 'st-hold'], ['done', 'הושלם', 'st-done']];
const SL = Object.fromEntries(STAGES.map(([k, l, c]) => [k, [l, c]]));
const KIND: Record<string, [string, any]> = { project: ['פרויקט', FolderKanban], brand: ['מותג', Sparkles], real_estate_project: ['פרויקט נדל״ן', Building2], campaign: ['קמפיין', Megaphone] };
const PRI: Record<string, string> = { low: 'נמוכה', normal: 'רגילה', high: 'גבוהה' };
const d = (x?: string | null) => x ? new Date(x).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

// Brands & projects: each one is a tracked piece of work for the client — stage, dates, tasks and an updates log.
export function ProjectsPanel({ clientId, data }: { clientId: string; data: any }) {
  const r = useRouter(); const list: any[] = data?.projects ?? []; const team: any[] = data?.team ?? [];
  const [open, setOpen] = useState<string | null>(list.find((p) => p.stage !== 'done')?.id ?? null); const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const act = async (a: string, p: any) => { setBusy(true); setMsg(''); try { const x = await callAction(a, p); if (x?.note) setMsg(x.note); r.refresh(); return x; } catch (e) { setMsg(heError(e)); } finally { setBusy(false); } };
  const all = list.flatMap((p) => p.tasks ?? []); const now = today();
  const k = { active: list.filter((p) => !['done', 'on_hold'].includes(p.stage)).length, wait: list.filter((p) => p.stage === 'waiting_client').length,
    late: all.filter((t) => t.status === 'open' && t.due_at && t.due_at.slice(0, 10) < now).length, done: list.filter((p) => p.stage === 'done').length };
  return <div className="pj">
    <div className="pj-top"><div className="kpis pj-kpis">
      <div className="kpi"><small>פרויקטים פעילים</small><b>{k.active}</b></div>
      <div className="kpi"><small>ממתינים ללקוח</small><b>{k.wait}</b></div>
      <div className="kpi"><small>משימות באיחור</small><b className={k.late ? 'bad' : ''}>{k.late}</b></div>
      <div className="kpi"><small>הושלמו</small><b>{k.done}</b></div></div>
      <button className="btn y" onClick={() => setCreating(true)}><Plus size={18} /> פרויקט / מותג חדש</button></div>
    {msg && <p className="small acc-msg">{msg}</p>}
    {!list.length && <div className="card pj-empty"><FolderKanban size={36} /><p>עוד אין פרויקטים ללקוח. כל עבודה חדשה (מותג, פרויקט נדל״ן, קמפיין, אתר) נפתחת כאן, עם סטטוס, משימות ויומן עדכונים.</p><button className="btn y" onClick={() => setCreating(true)}><Plus size={18} /> פתיחת פרויקט ראשון</button></div>}
    <div className="pj-list">{list.map((p) => <ProjectCard key={p.id} p={p} team={team} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} act={act} busy={busy} />)}</div>
    {creating && <NewProject clientId={clientId} team={team} onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); setOpen(id); r.refresh(); }} />}
  </div>;
}

function ProjectCard({ p, team, open, onToggle, act, busy }: { p: any; team: any[]; open: boolean; onToggle: () => void; act: (a: string, x: any) => Promise<any>; busy: boolean }) {
  const [K, Ico] = KIND[p.kind] ?? KIND.project; const [sl, sc] = SL[p.stage] ?? SL.planning; const tasks: any[] = p.tasks ?? [];
  const done = tasks.filter((t) => t.status === 'done').length; const pct = tasks.length ? Math.round((done / tasks.length) * 100) : p.stage === 'done' ? 100 : 0;
  const late = p.due_date && p.stage !== 'done' && p.due_date < today();
  const [title, setTitle] = useState(''); const [due, setDue] = useState(''); const [who, setWho] = useState(''); const [note, setNote] = useState(''); const [edit, setEdit] = useState(false);
  const name = (id: string) => team.find((x) => x.id === id)?.name;
  return <div className={`card pj-card ${open ? 'on' : ''}`}>
    <button className="pj-h" onClick={onToggle}>
      <span className={`pj-ico ${sc}`}><Ico size={22} /></span>
      <span className="pj-t"><b>{p.name}</b><small>{K}{p.site_url ? ` · ${p.site_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}` : ''}</small></span>
      <span className="pj-meta">
        <span className={`pj-st ${sc}`}>{sl}</span>
        {p.due_date && <span className={`pj-due ${late ? 'late' : ''}`}><CalendarDays size={14} /> {d(p.due_date)}</span>}
        {p.priority === 'high' && <span className="pj-due late"><Flag size={14} /> דחוף</span>}
        <span className="pj-prog" title={`${done}/${tasks.length} משימות`}><i style={{ width: `${pct}%` }} /></span><small className="pj-pct">{tasks.length ? `${done}/${tasks.length}` : '—'}</small>
      </span>
    </button>
    {open && <div className="pj-body">
      <div className="pj-stages" role="group" aria-label="סטטוס">{STAGES.map(([k, l, c]) => <button key={k} disabled={busy} className={`${c} ${p.stage === k ? 'on' : ''}`} onClick={() => p.stage !== k && act('project_save', { project_id: p.id, stage: k })}>{l}</button>)}</div>
      {p.description && !edit && <p className="pj-desc">{p.description}</p>}
      <div className="pj-facts">
        {p.start_date && <span><Clock size={14} /> התחלה {d(p.start_date)}</span>}
        {p.due_date && <span className={late ? 'late' : ''}><CalendarDays size={14} /> יעד {d(p.due_date)}</span>}
        {p.owner && <span>👤 {name(p.owner) ?? 'אחראי'}</span>}
        {p.budget && <span>₪ {Number(p.budget).toLocaleString('he-IL')}</span>}
        {p.site_url && <a href={p.site_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> אתר</a>}
        <span className="sp" />
        <button className="btn sm ghost" onClick={() => setEdit(!edit)}><Pencil size={14} /> עריכה</button>
        <button className="btn sm ghost" disabled={busy} onClick={() => window.confirm('להעביר את הפרויקט לארכיון?') && act('project_archive', { project_id: p.id })}><Archive size={14} /> ארכיון</button>
      </div>
      {edit && <EditProject p={p} team={team} onSave={async (x) => { await act('project_save', { project_id: p.id, ...x }); setEdit(false); }} />}
      <div className="pj-cols">
        <section><h3><ListChecks size={18} /> משימות</h3>
          <ul className="pj-tasks">{tasks.map((t) => { const lt = t.status === 'open' && t.due_at && t.due_at.slice(0, 10) < today();
            return <li key={t.id} className={t.status === 'done' ? 'done' : ''}><button aria-label={t.status === 'done' ? 'סמן כפתוחה' : 'סמן כבוצעה'} disabled={busy} onClick={() => act('project_task_set', { project_id: p.id, id: t.id, status: t.status === 'done' ? 'open' : 'done' })}>{t.status === 'done' ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button>
              <span className="sp">{t.title}{t.assignee && name(t.assignee) ? <small> · {name(t.assignee)}</small> : null}</span>{t.due_at && <small className={lt ? 'late' : ''}>{d(t.due_at)}</small>}</li>; })}
            {!tasks.length && <li className="muted small">אין עדיין משימות.</li>}</ul>
          <form className="pj-add" onSubmit={async (e) => { e.preventDefault(); if (!title.trim()) return; await act('project_task_add', { project_id: p.id, title, due, assignee: who }); setTitle(''); setDue(''); }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="משימה חדשה…" aria-label="משימה חדשה" />
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="תאריך יעד" />
            {team.length > 1 && <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="אחראי"><option value="">אחראי</option>{team.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
            <button className="btn sm y" disabled={busy || !title.trim()}><Plus size={16} /> הוספה</button></form></section>
        <section><h3><MessageSquareText size={18} /> עדכונים</h3>
          <form className="pj-add" onSubmit={async (e) => { e.preventDefault(); if (!note.trim()) return; await act('project_note', { project_id: p.id, text: note }); setNote(''); }}>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="מה קרה בפרויקט? (שיחה עם הלקוח, החלטה, חומר שהתקבל…)" aria-label="עדכון" />
            <button className="btn sm" disabled={busy || !note.trim()}>שמירת עדכון</button></form>
          <ol className="pj-log">{(p.updates ?? []).map((u: any, i: number) => <li key={i} className={u.kind}><small>{new Date(u.created_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{u.who ? ` · ${u.who}` : ''}</small><span>{u.text}</span></li>)}</ol></section>
      </div>
    </div>}
  </div>;
}

function Fields({ v, set, team }: { v: any; set: (x: any) => void; team: any[] }) {
  const f = (k: string) => (e: any) => set({ ...v, [k]: e.target.value });
  return <div className="pj-form">
    <label className="w2">שם<input value={v.name ?? ''} onChange={f('name')} required /></label>
    <label>סוג<select value={v.kind ?? 'project'} onChange={f('kind')}>{Object.entries(KIND).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
    <label>סטטוס<select value={v.stage ?? 'planning'} onChange={f('stage')}>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
    <label>תאריך התחלה<input type="date" value={v.start_date ?? ''} onChange={f('start_date')} /></label>
    <label>תאריך יעד<input type="date" value={v.due_date ?? ''} onChange={f('due_date')} /></label>
    <label>עדיפות<select value={v.priority ?? 'normal'} onChange={f('priority')}>{Object.entries(PRI).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
    <label>אחראי<select value={v.owner ?? ''} onChange={f('owner')}><option value="">—</option>{team.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>אתר / קישור<input dir="ltr" value={v.site_url ?? ''} onChange={f('site_url')} placeholder="https://" /></label>
    <label>תקציב (₪, לא חובה)<input type="number" value={v.budget ?? ''} onChange={f('budget')} /></label>
    <label className="w2">תיאור ומטרות<textarea rows={3} value={v.description ?? ''} onChange={f('description')} placeholder="מה בונים, למי, ומה נחשב הצלחה" /></label>
  </div>;
}
function EditProject({ p, team, onSave }: { p: any; team: any[]; onSave: (x: any) => Promise<void> }) {
  const [v, setV] = useState({ name: p.name, kind: p.kind, stage: p.stage, start_date: p.start_date ?? '', due_date: p.due_date ?? '', priority: p.priority, owner: p.owner ?? '', site_url: p.site_url ?? '', budget: p.budget ?? '', description: p.description ?? '' });
  return <form className="pj-edit" onSubmit={async (e) => { e.preventDefault(); await onSave(v); }}><Fields v={v} set={setV} team={team} /><button className="btn y sm">שמירה</button></form>;
}
function NewProject({ clientId, team, onClose, onDone }: { clientId: string; team: any[]; onClose: () => void; onDone: (id: string) => void }) {
  const [v, setV] = useState<any>({ kind: 'project', stage: 'planning', priority: 'normal', start_date: today() }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  return <Modal open onClose={onClose} label="פרויקט חדש"><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr('');
    try { const x = await callAction('create_project', { client_id: clientId, name: v.name, kind: v.kind, site_url: v.site_url || null });
      const { name, kind, ...rest } = v; await callAction('project_save', { project_id: x.id, ...rest }); onDone(x.id); } catch (e2) { setErr(heError(e2)); } finally { setBusy(false); } }}>
    <h2>פרויקט / מותג חדש</h2><Fields v={v} set={setV} team={team} />
    {err && <p className="err small">{err}</p>}
    <div className="row" style={{ gap: 8, marginTop: 12 }}><button className="btn y" disabled={busy || !v.name?.trim()}>{busy ? 'שומר…' : 'פתיחת הפרויקט'}</button><button type="button" className="btn ghost" onClick={onClose}>ביטול</button></div>
  </form></Modal>;
}
