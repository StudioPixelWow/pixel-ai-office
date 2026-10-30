import Link from 'next/link';
import { safeList, rpc, me } from '@/lib/api';
import { Hero, Table, Stat, Empty, Contract } from '@/components/ui';
import { fmtMoney, fmtDate } from '@/lib/format';
import { PAY_STATUS_HE, KIND_HE, VAT_MODE_HE, METHOD_HE } from '@/lib/services';
import { PaymentRowActions } from './payment-row-actions';
import { growConfigured } from '@/engine/adapters/grow';
import { greenInvoiceConfigured } from '@/engine/adapters/greeninvoice';

const TONE: Record<string, string> = { overdue: 'bad', due_soon: 'warn', paid: 'ok', partial: 'warn', link_created: 'cyan', scheduled: 'muted', waived: 'muted', cancelled: 'muted' };
const FILTERS: [string, string][] = [['open', 'פתוחים'], ['overdue', 'באיחור'], ['month', 'החודש'], ['paid', 'שולמו'], ['all', 'הכל']];

export default async function Payments({ searchParams }: { searchParams: Promise<{ f?: string; client?: string }> }) {
  const { f = 'open', client } = await searchParams; const m = await me();
  if (!['owner', 'admin'].includes(m.role)) return <Empty>מעקב התשלומים זמין לבעלים ולמנהלת המשרד בלבד.</Empty>;
  const [rows, plans, sum] = await Promise.all([safeList<any>('payments', client ? { client_id: client } : {}, 1000), safeList<any>('billing_plans', client ? { client_id: client } : {}, 500),
    rpc<any>('office_billing_summary').catch(() => null)]);
  const today = new Date().toISOString().slice(0, 10); const mon = today.slice(0, 7);
  const shown = rows.filter((p) => f === 'all' ? true : f === 'overdue' ? p.is_overdue : f === 'paid' ? ['paid', 'partial'].includes(p.status) && p.paid_at
    : f === 'month' ? p.due_date.startsWith(mon) : !['paid', 'waived', 'cancelled'].includes(p.status) && p.due_date <= addDays(today, 45));
  const grow = growConfigured(); const inv = greenInvoiceConfigured();
  return <>
    <Hero title={<>מעקב <span className="mark">תשלומים</span></>} sub="כל התשלומים הצפויים מהלקוחות — ריטיינרים חודשיים ופרויקטים חד-פעמיים. שליטה ובקרה למנהלת המשרד." />
    {sum && <div className="grid g4" style={{ marginBottom: 16 }}>
      <Stat n={fmtMoney(sum.month_expected)} label="צפוי החודש" /><Stat n={fmtMoney(sum.month_collected)} label="נגבה החודש" tone="ok" />
      <Stat n={`${sum.overdue_count} · ${fmtMoney(sum.overdue_sum)}`} label="באיחור" tone={sum.overdue_count ? 'bad' : undefined} href="/payments?f=overdue" />
      <Stat n={`${sum.active_retainers} · ${fmtMoney(sum.mrr)}`} label="ריטיינרים פעילים · הכנסה חודשית" /></div>}
    {sum?.gross_unknown > 0 && <p className="small muted">ל-{sum.gross_unknown} תשלומים אין סכום כולל מע״מ כי לא נבחרה תבנית מע״מ. אפשר לגבות ידנית; קישור תשלום דורש סכום סופי.</p>}
    <div className="row" style={{ margin: '8px 0 12px' }}>{FILTERS.map(([k, l]) => <Link key={k} className={`btn sm ${k === f ? 'y' : ''}`} href={`/payments?f=${k}${client ? `&client=${client}` : ''}`}>{l}</Link>)}
      <span className="sp" /><span className="small muted">Grow: {grow ? 'מוגדר' : 'לא מחובר'} · חשבונית ירוקה: {inv ? 'מוגדרת' : 'לא מחוברת'}</span></div>
    <Table head={['מועד', 'לקוח', 'הסדר', 'סכום', 'מע״מ', 'סטטוס', 'שולם', 'פעולות']} rows={shown.map((p) => [
      <b key="d">{fmtDate(p.due_date)}</b>, <Link key="c" href={`/clients/${p.client_id}?tab=billing`}>{p.client_name}</Link>,
      <span key="k" className="small">{p.plan_title}{p.period_month ? ` · ${p.period_month.slice(0, 7)}` : ''}</span>,
      <span key="a">{fmtMoney(p.amount)}{p.amount_gross != null && p.amount_gross !== p.amount && <span className="small muted"> · {fmtMoney(p.amount_gross)} כולל</span>}</span>,
      <span key="v" className="small">{VAT_MODE_HE[p.vat_mode]}</span>,
      <span key="s" className={`badge ${TONE[p.effective_status] ?? ''}`}>{PAY_STATUS_HE[p.effective_status] ?? p.effective_status}</span>,
      <span key="p" className="small">{p.paid_at ? `${fmtDate(p.paid_at)} · ${fmtMoney(p.paid_amount)} · ${METHOD_HE[p.method] ?? ''}` : '—'}</span>,
      <PaymentRowActions key="x" p={p} grow={grow} invoices={inv} />])} empty="אין תשלומים בתצוגה הזו" />
    <h2 style={{ marginTop: 24 }}>הסדרי תשלום</h2>
    <Table head={['לקוח', 'סוג', 'כותרת', 'סכום', 'יום תשלום', 'תשלום הבא', 'סטטוס']} rows={plans.map((b) => [<Link key="c" href={`/clients/${b.client_id}?tab=billing`}>{b.client_name}</Link>,
      KIND_HE[b.kind], b.title, `${fmtMoney(b.amount)} ${b.kind === 'retainer' ? 'לחודש' : ''}`, b.payment_day ?? (b.installments > 1 ? `${b.installments} תשלומים` : '—'), fmtDate(b.next_due), b.status === 'active' ? 'פעיל' : b.status === 'paused' ? 'מושהה' : 'הסתיים'])}
      empty={<>אין הסדרי תשלום. <Link href="/clients">הוסף לקוח</Link> עם סוג שירות וסכום.</>} />
    <Contract source="office.payments · office.billing_plans" actions="סימון תשלום, קישור תשלום (Grow), חשבונית (חשבונית ירוקה), עריכה, ויתור" perms="Owner ומנהלת משרד (admin) בלבד" empty="הנחיה להוספת לקוח" />
  </>;
}
function addDays(d: string, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
