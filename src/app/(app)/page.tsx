import Link from 'next/link';
import { rpc, me, safeList, today } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { buildQueue, QueueList } from '@/components/today-queue';
export const dynamic = 'force-dynamic';

const TZ = 'Asia/Jerusalem';
const tm = (d: string) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d));
const dm = (d: string) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, day: 'numeric', month: 'numeric' }).format(new Date(d));
const ago = (d: string) => { const s = Math.max(0, (Date.now() - +new Date(d)) / 1000); return s < 60 ? 'עכשיו' : s < 3600 ? `לפני ${Math.round(s / 60)} דק׳` : s < 86400 ? `לפני ${Math.round(s / 3600)} שע׳` : `לפני ${Math.round(s / 86400)} ימים`; };
const ST: Record<string, string> = { pending_approval: 'ממתין לאישור', approved: 'מאושר', scheduled: 'מתוזמן', design: 'בעיצוב', writing: 'בכתיבה', idea: 'רעיון', not_published: 'לא עלה', published: 'עלה' };

export default async function CommandCenter() {
  const [m, t, conns] = await Promise.all([me(), today(), safeList<any>('connections', {}, 50)]);
  if (!t) return <div className="card">לא ניתן לטעון את מרכז הבקרה כרגע.</div>;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date()));
  const hello = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : hour < 21 ? 'ערב טוב' : 'לילה טוב';
  const name = (m.email ?? '').startsWith('tal') ? 'טל' : '';
  const greg = new Intl.DateTimeFormat('he-IL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const heb = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const postsPending = (t.posts_pending ?? []).reduce((a: number, x: any) => a + Number(x.count), 0);
  const knPending = (t.knowledge_pending ?? []).reduce((a: number, x: any) => a + Number(x.count), 0);
  const todayPosts = (t.posts_soon ?? []).filter((p: any) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(p.due_at)) === t.today);
  const money = t.money; const live: any[] = t.live ?? [];
  const brokenConns = conns.filter((c) => ['expired', 'requires_user', 'not_connected'].includes(c.status) && ['anthropic', 'openai_api', 'gmail', 'grow', 'green_invoice'].includes(c.provider));

  const q = buildQueue(t, brokenConns);

  return <div className="cc">
    <section className="cc-hero">
      <div>
        <small>{greg} · {heb}</small>
        <h1>{hello}{name ? `, ${name}` : ''}</h1>
        <p>{q.length ? <>יש <b>{q.length}</b> דברים שמחכים לך היום{live.length ? <> · <b>{live.length}</b> סוכנים עובדים עכשיו</> : ''}.</> : 'הכל מטופל. המשרד עובד בשבילך.'}</p>
        {(t.next_markers ?? []).length > 0 && <div className="cc-markers">{(t.next_markers ?? []).slice(0, 4).map((x: any) => <span key={x.date + x.title} className={x.no_marketing ? 'nomkt' : ''}>{dm(x.date)} · {x.title}</span>)}</div>}
      </div>
      <div className="cc-quick">
        <Link className="btn y" href="/talk">＋ משימה חדשה לסוכנים</Link>
        <Link className="btn" href="/clients?new=1">לקוח חדש</Link>
        <Link className="btn" href="/leads?new=1">ליד חדש</Link>
        <Link className="btn" href="/content">גאנט תוכן</Link>
      </div>
    </section>

    <section className="cc-kpis">
      <Link href="/approvals" className={`cc-kpi ${q.length ? 'hot' : ''}`}><b>{q.length}</b><span>לטיפולך</span></Link>
      <Link href="/content" className="cc-kpi"><b>{todayPosts.length}</b><span>פוסטים היום</span><small>{postsPending} ממתינים לאישור</small></Link>
      <Link href="/office" className="cc-kpi live"><b>{live.length}</b><span>סוכנים בעבודה</span><small>{t.done_today} משימות הושלמו היום</small></Link>
      <Link href="/leads" className="cc-kpi"><b>{t.leads_new}</b><span>לידים חדשים השבוע</span><small>{t.proposals_sent} הצעות אצל לקוחות</small></Link>
      {money ? <Link href="/payments" className={`cc-kpi ${Number(money.overdue_total) > 0 ? 'warn' : ''}`}><b>{fmtMoney(money.received_month)}</b><span>נכנס החודש</span><small>מתוך {fmtMoney(money.expected_month)} צפוי</small></Link>
        : <Link href="/clients" className="cc-kpi"><b>{knPending}</b><span>פריטי ידע לאישור</span></Link>}
    </section>

    <div className="cc-main">
      <section className="cc-card cc-queue">
        <header><h2>התור שלך להיום</h2><span className="muted small">מהדחוף לפחות דחוף</span></header>
        <QueueList q={q} />
      </section>

      <section className="cc-card cc-live">
        <header><h2><span className="cc-pulse" />המשרד בלייב</h2><Link className="small" href="/office">כל הסוכנים ←</Link></header>
        {live.length ? live.map((a) => <Link key={a.id} href={a.request_id ? `/room/${a.request_id}` : `/tasks/${a.id}`} className="cc-agent">
            <span className="cc-av">{a.avatar ? <img src={`/api/avatar/${a.avatar}`} alt="" /> : (a.name ?? '?')[0]}</span>
            <div><b>{a.name ?? a.agent}</b><small>{a.action || a.title}</small></div><em>{a.started ? ago(a.started) : ''}</em></Link>)
          : <div className="cc-empty"><b>הסוכנים זמינים</b><p>{t.agents_total} סוכנים מחכים למשימה{t.queued ? ` · ${t.queued} בתור` : ''}.</p><Link className="btn sm y" href="/talk">תן להם עבודה</Link></div>}
        {(t.feed ?? []).length > 0 && <><h3>מה קרה לאחרונה</h3><ul className="cc-feed">{(t.feed ?? []).slice(0, 7).map((e: any, i: number) =>
          <li key={i}><span className="cc-av sm">{e.avatar ? <img src={`/api/avatar/${e.avatar}`} alt="" /> : '•'}</span><div>{e.request_id ? <Link href={`/room/${e.request_id}`}>{e.message}</Link> : e.message}<small>{e.name ? `${e.name} · ` : ''}{ago(e.at)}</small></div></li>)}</ul></>}
      </section>
    </div>

    <section className="cc-card cc-week">
      <header><h2>השבוע בתוכן</h2><Link className="small" href="/content">לגאנט המלא ←</Link></header>
      <div className="cc-days">{(t.week_posts ?? []).map((d: any) => { const dt = new Date(d.day + 'T12:00:00Z');
        return <div key={d.day} className={`cc-day ${d.day === t.today ? 'today' : ''} ${(d.markers ?? []).some((x: any) => x.no_marketing) ? 'nomkt' : ''}`}>
          <small>{new Intl.DateTimeFormat('he-IL', { weekday: 'short', timeZone: 'UTC' }).format(dt)}</small><b>{dt.getUTCDate()}</b>
          <span className="cc-count">{d.total ? `${d.published}/${d.total} עלו` : '—'}</span>
          {(d.markers ?? []).slice(0, 1).map((x: any) => <em key={x.title}>{x.title}</em>)}</div>; })}</div>
      {(t.posts_soon ?? []).length > 0 && <div className="cc-posts">{(t.posts_soon ?? []).slice(0, 8).map((p: any) =>
        <Link key={p.id} href={`/content?client=${p.client_id}`} className="cc-post">{p.creative ? <img src={`/api/files/${p.creative}`} alt="" /> : <span className="cc-noimg">❝</span>}
          <div><b>{p.topic}</b><small>{p.client} · {dm(p.due_at)} {tm(p.due_at)}</small><i className={`st-${p.status}`}>{ST[p.status] ?? p.status}</i></div></Link>)}</div>}
    </section>

    {money && <div className="cc-two">
      <section className="cc-card">
        <header><h2>כסף החודש</h2><Link className="small" href="/payments">מעקב תשלומים ←</Link></header>
        <div className="cc-bar"><i style={{ width: `${Math.min(100, Number(money.expected_month) ? (Number(money.received_month) / Number(money.expected_month)) * 100 : 0)}%` }} /></div>
        <div className="cc-money"><div><small>נכנס</small><b>{fmtMoney(money.received_month)}</b></div><div><small>צפוי החודש</small><b>{fmtMoney(money.expected_month)}</b></div><div className={Number(money.overdue_total) ? 'warn' : ''}><small>באיחור</small><b>{fmtMoney(money.overdue_total)}</b></div></div>
        {(money.due_week ?? []).length > 0 && <><h3>נכנס השבוע</h3><ul className="cc-list">{money.due_week.map((p: any) => <li key={p.id}><span>{p.client} · {p.title}</span><b>{fmtMoney(p.amount)}</b><small>{dm(p.due)}</small></li>)}</ul></>}
      </section>
      <section className="cc-card">
        <header><h2>מכירות</h2><Link className="small" href="/leads">לידים והצעות ←</Link></header>
        <div className="cc-funnel">
          <Link href="/leads"><b>{t.leads_open}</b><small>לידים פתוחים</small></Link><Link href="/proposals"><b>{t.proposals_sent}</b><small>הצעות אצל לקוחות</small></Link><Link href="/proposals"><b>{t.signed_month}</b><small>נחתמו החודש</small></Link>
        </div>
        <p className="small muted">עלות סוכני AI: היום ${Number(money.usage_today ?? 0).toFixed(2)} · החודש ${Number(money.usage_month ?? 0).toFixed(2)}</p>
      </section>
    </div>}
  </div>;
}
