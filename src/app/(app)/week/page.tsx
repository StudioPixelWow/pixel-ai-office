import Link from 'next/link';
import { rpc } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { ROSTER } from '@/agents/roster';
export const dynamic = 'force-dynamic';
const TZ = 'Asia/Jerusalem';
const day = (d: string) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'numeric' }).format(new Date(d.length === 10 ? `${d}T12:00:00Z` : d));
const tm = (d: string) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d));
const dk = (d: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d.length === 10 ? `${d}T12:00:00Z` : d));
const NAME = Object.fromEntries(ROSTER.map((a) => [a.id, `${a.name} · ${a.role_title}`]));
const STAGE: Record<string, string> = { new: 'חדש', scoping: 'אפיון', proposal_drafting: 'הצעה בכתיבה', pending_approval: 'ממתין לאישור', ready_to_send: 'מוכן לשליחה', sent: 'הצעה נשלחה', negotiation: 'מו״מ' };

export default async function Week({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const w: any = await rpc('office_week', d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? { p_start: d } : {}).catch(() => null);
  if (!w) return <div className="card">לא ניתן לטעון את תוכנית השבוע.</div>;
  const days = Array.from({ length: 7 }, (_, i) => { const x = new Date(`${w.start}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + i); return x.toISOString().slice(0, 10); });
  const shift = (n: number) => { const x = new Date(`${w.start}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 7 * n); return `/week?d=${x.toISOString().slice(0, 10)}`; };
  const late = [...w.milestones.filter((m: any) => m.late), ...w.todos.filter((t: any) => t.late)];
  const waitClient = w.milestones.filter((m: any) => m.status === 'waiting_client' || m.needs_client);
  const stuckPosts = (w.posts ?? []).filter((p: any) => p.not_ready || p.pending);
  return <div className="wk">
    <section className="pg-head pg-hero"><div><h1>מצב <span className="mark">שבוע</span></h1><p>{day(w.start)} – {day(w.end)} · מי עושה מה, מה תקוע ומה צריך ממך כדי שהשבוע ירוץ.</p></div>
      <div className="row"><Link className="btn sm ghost" href={shift(-1)}>→ שבוע קודם</Link><Link className="btn sm ghost" href="/week">השבוע</Link><Link className="btn sm ghost" href={shift(1)}>שבוע הבא ←</Link></div></section>
    <section className="kpis">
      <div className="kpi"><b>{w.meetings.length}</b><span>פגישות</span></div>
      <div className="kpi"><b>{w.milestones.length}</b><span>אבני דרך לשבוע</span></div>
      <div className={`kpi ${late.length ? 'hot' : ''}`}><b>{late.length}</b><span>באיחור</span></div>
      <div className="kpi"><b>{(w.posts ?? []).reduce((a: number, p: any) => a + Number(p.total), 0)}</b><span>פוסטים מתוכננים</span></div>
      <div className={`kpi ${w.blockers.length ? 'hot' : ''}`}><b>{w.blockers.length}</b><span>חסמים לשחרר</span></div>
    </section>
    {(w.blockers.length > 0 || stuckPosts.length > 0 || waitClient.length > 0) && <section className="wk-card wk-alert"><h2>🔓 לשחרר השבוע</h2><ul className="wk-list">
      {w.blockers.map((b: any) => <li key={b.id}><Link href={b.request_id ? `/room/${b.request_id}` : `/tasks/${b.id}`}><b>{b.title}</b><small>{NAME[b.agent] ?? b.agent} · {b.blocker ?? 'ממתין'}</small></Link></li>)}
      {stuckPosts.map((p: any) => <li key={p.client_id}><Link href={`/content?client=${p.client_id}`}><b>{p.client} · {p.total} פוסטים השבוע</b><small>{p.pending ? `${p.pending} ממתינים לאישורך` : ''}{p.pending && p.not_ready ? ' · ' : ''}{p.not_ready ? `${p.not_ready} עוד לא מוכנים` : ''}</small></Link></li>)}
      {waitClient.map((m: any) => <li key={m.id}><Link href={`/clients/${m.client_id}?tab=milestones`}><b>מחכה ללקוח · {m.client}</b><small>{m.title}</small></Link></li>)}
    </ul></section>}
    <section className="wk-days">{days.map((k) => { const ms = w.meetings.filter((m: any) => dk(m.at) === k); const mil = w.milestones.filter((m: any) => !m.late && m.due === k); const td = w.todos.filter((t: any) => t.due && !t.late && dk(t.due) === k);
      return <div key={k} className={`wk-day ${k === new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()) ? 'today' : ''}`}><h3>{day(k)}</h3>
        {ms.map((m: any) => <p key={m.id} className="wk-ev m">🤝 {tm(m.at)} {m.title}{m.client ? ` · ${m.client}` : ''}</p>)}
        {mil.map((m: any) => <p key={m.id} className="wk-ev ms">◆ {m.title} · {m.client}</p>)}
        {td.map((t: any) => <p key={t.id} className="wk-ev t">☐ {t.title}</p>)}
        {!ms.length && !mil.length && !td.length && <p className="wk-free">פנוי</p>}</div>; })}</section>
    <div className="fc-two">
      <section className="wk-card"><h2>הסוכנים השבוע</h2>{(w.agents ?? []).length ? <ul className="wk-list">{w.agents.map((a: any) => <li key={a.agent}><div><b>{NAME[a.agent] ?? a.agent}</b>
        <small>{[a.running && `${a.running} בעבודה`, a.queued && `${a.queued} בתור`, a.approve && `${a.approve} ממתינות לאישור`, a.blocked && `${a.blocked} תקועות`].filter(Boolean).join(' · ')}</small></div></li>)}</ul> : <p className="muted">אין משימות פתוחות לסוכנים. <Link href="/talk">תן להם עבודה</Link></p>}</section>
      <section className="wk-card"><h2>מכירות ותשלומים</h2><ul className="wk-list">
        {w.leads.map((l: any) => <li key={l.id}><Link href={`/leads/${l.id}`}><b>ליד · {l.name}</b><small>{STAGE[l.stage] ?? l.stage} · לפני {l.age} ימים</small></Link></li>)}
        {w.payments.map((p: any, i: number) => <li key={i}><div><b>{p.client} · {fmtMoney(p.amount)}</b><small>{p.late ? 'באיחור · ' : ''}{day(p.due)}</small></div></li>)}
        {!w.leads.length && !w.payments.length && <li><small>אין לידים פתוחים או תשלומים השבוע.</small></li>}</ul></section>
    </div>
    {late.length > 0 && <section className="wk-card"><h2>באיחור</h2><ul className="wk-list">{late.map((x: any) => <li key={x.id}><div><b>{x.title}</b><small>{x.client ?? ''}{x.due ? ` · ${day(x.due)}` : ''}</small></div></li>)}</ul></section>}
  </div>;
}
