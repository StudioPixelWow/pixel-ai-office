import Link from 'next/link';
import { rpc, me } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { Opportunities } from '@/components/opportunities';
export const dynamic = 'force-dynamic';
const ST: Record<string, string> = { drafting: 'בכתיבה', in_review: 'בבדיקה', pending_owner: 'ממתינה לאישורך', ready_to_send: 'מוכנה לשליחה', sent: 'נשלחה', negotiation: 'במו״מ' };
const mon = (d: string) => new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));

export default async function Forecast() {
  const m = await me();
  if (!['owner', 'admin'].includes(m.role)) return <div className="card">התחזית זמינה לבעלים ולמנהלת המשרד בלבד.</div>;
  const [f, opps]: any[] = await Promise.all([rpc('office_forecast').catch(() => null), rpc<any[]>('office_opportunities', {}).catch(() => [])]);
  if (!f) return <div className="card">לא ניתן לטעון את התחזית כרגע.</div>;
  const months: any[] = f.months ?? []; const max = Math.max(1, ...months.map((x) => Number(x.paid) + Number(x.committed) + Number(x.weighted)));
  const total3 = months.reduce((a, x) => a + Number(x.paid) + Number(x.committed), 0); const weighted3 = months.reduce((a, x) => a + Number(x.weighted), 0);
  return <div className="fc">
    <section className="pg-head pg-hero"><div><h1>תחזית <span className="mark">הכנסות</span></h1><p>3 החודשים הקרובים: מה כבר נכנס, מה מובטח (ריטיינרים ותשלומים מתוזמנים) ומה צפוי מהצעות פתוחות לפי סיכוי סגירה.</p></div></section>
    <section className="fc-kpis">
      <div><b>{fmtMoney(f.mrr)}</b><span>ריטיינרים בחודש (MRR)</span></div>
      <div><b>{fmtMoney(total3)}</b><span>מובטח ב-3 חודשים</span></div>
      <div className="c"><b>{fmtMoney(weighted3)}</b><span>צפוי מהצעות (משוקלל)</span></div>
      <div className={Number(f.overdue) ? 'warn' : ''}><b>{fmtMoney(f.overdue)}</b><span>באיחור לגבייה</span></div>
    </section>
    <section className="fc-card">
      <h2>תזרים צפוי</h2>
      <div className="fc-bars">{months.map((x) => { const p = Number(x.paid), c = Number(x.committed), w = Number(x.weighted);
        return <div key={x.month} className="fc-col">
          <div className="fc-stack" title={`נכנס ${fmtMoney(p)} · מובטח ${fmtMoney(c)} · משוקלל ${fmtMoney(w)}`}>
            <i className="w" style={{ height: `${(w / max) * 100}%` }} /><i className="c" style={{ height: `${(c / max) * 100}%` }} /><i className="p" style={{ height: `${(p / max) * 100}%` }} />
          </div>
          <b>{fmtMoney(p + c + w)}</b><span>{mon(x.month)}</span>
          <small>נכנס {fmtMoney(p)} · מובטח {fmtMoney(c)}{w ? ` · +${fmtMoney(w)} צפוי` : ''}</small>
        </div>; })}</div>
      <div className="fc-legend"><span><i className="p" />נכנס</span><span><i className="c" />מובטח</span><span><i className="w" />צפוי מהצעות</span></div>
    </section>
    <div className="fc-two">
      <section className="fc-card"><h2>הצעות פתוחות לפי סיכוי</h2>
        {(f.pipeline ?? []).length ? <ul className="fc-list">{f.pipeline.map((x: any) => <li key={x.id}><Link href={`/proposals/${x.id}`}><b>{x.title}</b><small>{ST[x.status] ?? x.status} · סיכוי {Math.round(x.prob * 100)}%</small></Link>
          <span>{x.monthly ? `${fmtMoney(x.monthly)}/ח׳` : ''}{x.setup ? `${x.monthly ? ' + ' : ''}${fmtMoney(x.setup)}` : ''}{!x.monthly && !x.setup ? 'מחיר לא ננעל' : ''}</span></li>)}</ul>
          : <div className="cc-empty"><b>אין הצעות פתוחות</b><p>הצעה חדשה נבנית מליד — <Link href="/leads?new=1">ליד חדש</Link>.</p></div>}
      </section>
      <section className="fc-card"><h2>הלקוחות הגדולים (ריטיינר)</h2>
        {(f.top_clients ?? []).length ? <ul className="fc-list">{f.top_clients.map((x: any) => <li key={x.id}><Link href={`/clients/${x.id}?tab=billing`}><b>{x.name}</b><small>{Number(f.mrr) ? Math.round((x.mrr / f.mrr) * 100) : 0}% מההכנסה החודשית</small></Link><span>{fmtMoney(x.mrr)}</span></li>)}</ul>
          : <div className="cc-empty"><b>עוד אין ריטיינרים</b><p>הם נוצרים אוטומטית כשנחתמת הצעה עם תשלום חודשי.</p></div>}
      </section>
    </div>
    <section className="fc-card"><h2>הזדמנויות להגדלת עסקה ({(opps ?? []).length})</h2><Opportunities items={opps ?? []} /></section>
    <p className="small muted" style={{ textAlign: 'center' }}>סיכויי סגירה: במו״מ 60% · נשלחה 40% · מוכנה לשליחה 25% · ממתינה לאישורך 20% · בכתיבה 10%.</p>
  </div>;
}
