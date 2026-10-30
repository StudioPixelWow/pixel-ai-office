import Link from 'next/link';
import { safeList } from '@/lib/api';
import { Hero, Table, Badge, Contract } from '@/components/ui';
import { LeadForm } from './lead-form';
import { fmtMoney, he } from '@/lib/format';
const STAGES = ['new', 'scoping', 'proposal_drafting', 'pending_approval', 'ready_to_send', 'sent', 'negotiation', 'engaged', 'lost', 'archived'];
export default async function Leads() {
  const leads = await safeList('leads', { _active: true }, 500);
  return <>
    <Hero title={<>לידים <span className="mark">ומכירות</span></>} sub="תקציב הלקוח והמחיר שלך הם שדות שונים. המחיר שלך הוא מקור האמת." />
    <div className="grid g3" style={{ marginBottom: 16 }}>{STAGES.slice(0, 9).map((s) => <div key={s} className="card"><b>{he(s)}</b> <span className="badge">{leads.filter((l: any) => l.stage === s).length}</span>
      <div className="small">{leads.filter((l: any) => l.stage === s).slice(0, 4).map((l: any) => <div key={l.id}><Link href={`/leads/${l.id}`}>{l.company}</Link></div>)}</div></div>)}</div>
    <div className="grid g2">
      <Table head={['חברה', 'איש קשר', 'עיסוק', 'שלב']} rows={leads.map((l: any) => [<Link key="l" href={`/leads/${l.id}`}><b>{l.company}</b></Link>, l.contact_name ?? '—', l.industry ?? '—', <Badge key="b" s={l.stage} />])} empty="אין לידים" />
      <div className="card"><h2>ליד חדש</h2><LeadForm /></div></div>
    <Contract source="office.leads" actions="קליטה ידנית/הדבקה, מניעת כפילות לפי טלפון/מייל, מעבר לשלב" perms="Owner/מנהל/מנהל לקוח" empty="אין לידים" />
  </>;
}
