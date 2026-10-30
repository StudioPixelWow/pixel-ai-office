'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';
const ST: [string, string, string][] = [['todo', 'לביצוע', '○'], ['in_progress', 'בעבודה', '◐'], ['waiting_client', 'ממתין ללקוח', '⏳'], ['done', 'בוצע', '✓'], ['skipped', 'לא רלוונטי', '–']];
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
const fdate = (d?: string) => d ? new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric' }).format(new Date(d)) : '—';
const mname = (d: string) => new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date(d));
export function Milestones({ clientId, items, engagements }: { clientId: string; items: any[]; engagements: any[] }) {
  const r = useRouter(); const [pop, setPop] = useState<string | null>(null); const [err, setErr] = useState(''); const [add, setAdd] = useState({ title: '', due_date: '' });
  const months = useMemo(() => [...new Set(items.filter((x) => x.mode === 'monthly').map((x) => x.period_month))].sort(), [items]);
  const curMonth = months.find((m) => m.slice(0, 7) === today.slice(0, 7)) ?? months[months.length - 1];
  const [month, setMonth] = useState<string | undefined>(curMonth);
  const oneTime = items.filter((x) => x.mode !== 'monthly'); const monthly = items.filter((x) => x.mode === 'monthly' && x.period_month === month);
  const all = [...oneTime, ...monthly]; const done = all.filter((x) => ['done', 'skipped'].includes(x.status)).length;
  async function set(id: string, status: string) { setPop(null); try { await callAction('milestone_update', { id, status }); r.refresh(); } catch (e) { setErr(heError(e)); } }
  const group = (arr: any[]) => { const m = new Map<string, any[]>(); for (const x of arr) m.set(x.service ?? 'כללי', [...(m.get(x.service ?? 'כללי') ?? []), x]); return [...m.entries()]; };
  const Item = (x: any) => { const late = !['done', 'skipped'].includes(x.status) && x.due_date && x.due_date < today; const st = ST.find((s) => s[0] === x.status)!;
    return <div key={x.id} className={`ms-item ${x.status}${late ? ' late' : ''}`} style={{ position: 'relative' }}>
      <button className="ms-dot" title={st[1]} onClick={() => setPop(pop === x.id ? null : x.id)} aria-label={`סטטוס: ${st[1]}`}>{st[2] === '○' ? '' : st[2]}</button>
      <div className="ms-t"><b>{x.title}</b><small>{[x.agent_name && `👤 ${x.agent_name}`, x.needs_client && 'תלוי בלקוח', st[1]].filter(Boolean).join(' · ')}</small></div>
      <span className="ms-due">{late ? 'באיחור · ' : ''}{fdate(x.due_date)}</span>
      {pop === x.id && <div className="ms-pop" style={{ top: 40, insetInlineStart: 0 }}>{ST.map(([k, l, i]) => <button key={k} onClick={() => set(x.id, k)}>{i} {l}</button>)}</div>}
    </div>; };
  if (!items.length) return <div className="card ms"><h2>אבני דרך</h2><p className="muted">אבני הדרך נוצרות אוטומטית כשנפתחת עסקה מהצעה חתומה: תוכנית חד-פעמית לכל שירות, ואבני דרך שחוזרות כל חודש לשירותי ריטיינר.</p>
    {engagements.map((e) => <button key={e.id} className="btn y" onClick={async () => { try { await callAction('milestones_sync', { engagement_id: e.id }); r.refresh(); } catch (x) { setErr(heError(x)); } }}>צור אבני דרך לעסקה</button>)}{err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}</div>;
  return <div className="ms">
    <div className="ms-head"><h2 style={{ margin: 0 }}>אבני דרך</h2><div className="ms-prog" aria-label={`${done} מתוך ${all.length}`}><i style={{ width: `${all.length ? (done / all.length) * 100 : 0}%` }} /></div><b>{done}/{all.length}</b></div>
    {err && <div className="ldo-flash bad">{err}</div>}
    {oneTime.length > 0 && <><h3 style={{ margin: 0 }}>תוכנית הקמה ופרויקטים</h3>{group(oneTime).map(([g, arr]) => <section key={g} className="ms-group"><header><b>{g}</b><span className="badge cyan">{arr.filter((x) => x.status === 'done').length}/{arr.length}</span></header>{arr.map(Item)}</section>)}</>}
    {months.length > 0 && <><div className="row"><h3 style={{ margin: 0 }}>ריטיינר — אבני דרך חודשיות</h3><span className="sp" />
      <div className="ms-months">{months.map((m) => <button key={m} className={m === month ? 'on' : ''} onClick={() => setMonth(m)}>{mname(m)}</button>)}</div></div>
      {group(monthly).map(([g, arr]) => <section key={g} className="ms-group"><header><b>{g}</b><span className="badge cyan">{arr.filter((x) => x.status === 'done').length}/{arr.length}</span></header>{arr.map(Item)}</section>)}</>}
    <section className="ms-group"><header><b>אבן דרך נוספת</b></header><div className="row"><input value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value })} placeholder="מה צריך לקרות?" style={{ flex: 2 }} />
      <input type="date" value={add.due_date} onChange={(e) => setAdd({ ...add, due_date: e.target.value })} style={{ flex: 1 }} />
      <button className="btn" disabled={!add.title.trim()} onClick={async () => { try { await callAction('milestone_add', { client_id: clientId, engagement_id: engagements[0]?.id, ...add }); setAdd({ title: '', due_date: '' }); r.refresh(); } catch (e) { setErr(heError(e)); } }}>＋ הוסף</button></div></section>
  </div>;
}
