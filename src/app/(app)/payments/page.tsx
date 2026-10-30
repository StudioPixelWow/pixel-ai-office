import Link from 'next/link';
import { safeList, rpc, me } from '@/lib/api';
import { Table, Empty, Contract } from '@/components/ui';
import { fmtMoney, fmtDate } from '@/lib/format';
import { KIND_HE, VAT_MODE_HE } from '@/lib/services';
import { Ledger } from './ledger';
import { growConfigured } from '@/engine/adapters/grow';
import { greenInvoiceConfigured, giEnv } from '@/engine/adapters/greeninvoice';


export default async function Payments({ searchParams }: { searchParams: Promise<{ m?: string; client?: string }> }) {
  const { m: month } = await searchParams; const m = await me();
  if (!['owner', 'admin'].includes(m.role)) return <Empty>הנהלת החשבונות זמינה לבעלים ולמנהלת המשרד בלבד.</Empty>;
  const [d, plans] = await Promise.all([rpc<any>('office_accounting', { p_month: /^\d{4}-\d{2}$/.test(month ?? '') ? month : null }), safeList<any>('billing_plans', {}, 500)]);
  return <>
    <Ledger d={d} isOwner={m.role === 'owner'} invoices={greenInvoiceConfigured()} invEnv={giEnv()} grow={growConfigured()} />
    <details className="card" style={{ marginTop: 18 }}><summary><b>הסדרי תשלום ({plans.filter((b) => b.status !== 'ended').length})</b></summary>
    <Table head={['לקוח', 'סוג', 'כותרת', 'סכום', 'מע״מ', 'יום תשלום', 'תשלום הבא', 'סטטוס']} rows={plans.filter((b) => b.status !== 'ended').map((b) => [<Link key="c" href={`/clients/${b.client_id}?tab=billing`}>{b.client_name}</Link>,
      KIND_HE[b.kind], b.title, `${fmtMoney(b.amount)} ${b.kind === 'retainer' ? 'לחודש' : ''}`, VAT_MODE_HE[b.vat_mode] ?? '', b.payment_day ?? (b.installments > 1 ? `${b.installments} תשלומים` : '—'), fmtDate(b.next_due), b.status === 'active' ? 'פעיל' : b.status === 'paused' ? 'מושהה' : 'הסתיים'])}
      empty={<>אין הסדרי תשלום. <Link href="/clients">הוסף לקוח</Link> עם סוג שירות וסכום.</>} /></details>
    <Contract source="office.payments · office.payment_documents · office.billing_plans" actions="רישום תשלום (העברה/אשראי/ביט/צ׳ק/מזומן + אסמכתא), חשבונית מס / חשבונית מס קבלה / קבלה (חשבונית ירוקה, בלחיצה מאושרת), קישור תשלום (Grow), ייצוא לרו״ח" perms="Owner ומנהלת משרד (admin) בלבד" empty="הנחיה להוספת לקוח" />
  </>;
}
