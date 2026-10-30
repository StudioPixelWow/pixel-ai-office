import Link from 'next/link';
import { safeList } from '@/lib/api';
import { Hero, Badge } from '@/components/ui';
import { fmtMoney } from '@/lib/format';
// Proposals board: every proposal with its client/lead, price and where it stands. Opens in a sheet.
const GROUPS: [string, string[]][] = [['בהכנה', ['draft', 'drafting', 'pending_approval']], ['מוכנות לשליחה', ['approved', 'ready_to_send']], ['אצל הלקוח', ['sent', 'viewed', 'negotiation']], ['נחתמו', ['accepted']], ['נסגרו בלי עסקה', ['rejected', 'expired', 'lost']]];
export default async function Proposals() {
  const [ps0, leads, clients] = await Promise.all([safeList<any>('proposals', {}, 300), safeList<any>('leads', {}, 500), safeList<any>('clients', {}, 500)]);
  const ps = ps0.filter((p: any) => !p.archived_at);
  const ln = Object.fromEntries(leads.map((l) => [l.id, l.company])); const cn = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const known = new Set(GROUPS.flatMap(([, s]) => s)); const other = ps.filter((p) => !known.has(p.status));
  const won = ps.filter((p) => p.status === 'accepted');
  return <>
    <Hero title={<>הצעות <span className="mark">מחיר</span></>} sub="הצעה ממותגת נוצרת מכל ליד. כשהלקוח חותם דיגיטלית — העסקה, תיק הלקוח ואבני הדרך נפתחים אוטומטית." />
    <div className="kpis">
      <div className="kpi"><b>{ps.length}</b><span>הצעות</span></div>
      <div className="kpi"><b>{ps.filter((p) => ['sent', 'viewed', 'negotiation'].includes(p.status)).length}</b><span>אצל לקוחות</span></div>
      <div className="kpi"><b>{won.length}</b><span>נחתמו</span></div>
      <div className="kpi"><b>{fmtMoney(won.reduce((a, p) => a + Number(p.locked_monthly ?? 0), 0))}</b><span>ריטיינר חודשי שנחתם</span></div>
      <div className="kpi"><b>{fmtMoney(won.reduce((a, p) => a + Number(p.locked_setup ?? 0), 0))}</b><span>הקמות שנחתמו</span></div>
    </div>
    {ps.length ? [...GROUPS, ['אחר', [...new Set(other.map((p) => p.status))]] as [string, string[]]].map(([g, st]) => { const items = ps.filter((p) => st.includes(p.status)); if (!items.length) return null;
      return <section key={g} style={{ marginBottom: 18 }}><h2>{g} <span className="badge">{items.length}</span></h2><div className="cgrid">{items.map((p) =>
        <Link key={p.id} href={`/proposals/${p.id}`} scroll={false} className="ccard"><div className="bc-h"><span className="av">❖</span><div><b>{p.title}</b><small>{cn[p.client_id] ?? ln[p.lead_id] ?? '—'}{p.number ? ` · ${p.number}` : ''}</small></div></div>
          <div className="cc-meta"><Badge s={p.status} /><span>{p.locked_monthly ? `${fmtMoney(p.locked_monthly)}/ח׳` : ''}{p.locked_setup ? ` · הקמה ${fmtMoney(p.locked_setup)}` : ''}{!p.price_locked_at ? 'טרם נקבע מחיר' : ''}</span></div></Link>)}</div></section>; })
      : <div className="onb"><h2>עוד אין הצעות</h2><p>פותחים ליד, ומהכרטיס שלו יוצרים הצעה ממותגת בלחיצה.</p><Link className="btn y" href="/leads">ללידים ←</Link></div>}
  </>;
}
