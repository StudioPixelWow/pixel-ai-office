import Link from 'next/link';
import { safeList } from '@/lib/api';
import { Hero, Table, Badge } from '@/components/ui';
import { fmtMoney } from '@/lib/format';
export default async function Proposals() {
  const [ps, es] = await Promise.all([safeList('proposals', {}, 300), safeList('engagements', {}, 300)]);
  return <>
    <Hero title={<>הצעות <span className="mark">והתקשרויות</span></>} sub="שליחת הצעה אינה אישור להתקשרות; צפייה בקישור אינה חתימה." />
    <h2>הצעות</h2><Table head={['הצעה', 'סטטוס', 'הקמה', 'חודשי', 'מדיה (נפרד)', 'גרסה']} rows={ps.map((p: any) => [<Link key="l" href={`/proposals/${p.id}`}>{p.title}</Link>, <Badge key="b" s={p.status} />, fmtMoney(p.locked_setup), fmtMoney(p.locked_monthly), fmtMoney(p.locked_media_budget), p.current_version])} />
    <h2 style={{ marginTop: 20 }}>התקשרויות</h2><Table head={['לקוח', 'סטטוס', 'הקמה', 'חודשי', 'מדיה']} rows={es.map((e: any) => [<Link key="l" href={`/clients/${e.client_id}?tab=services`}>תיק לקוח</Link>, <Badge key="b" s={e.status} />, fmtMoney(e.setup_fee), fmtMoney(e.monthly_fee), fmtMoney(e.media_budget)])} />
  </>;
}
