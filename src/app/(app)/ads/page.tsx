import Link from 'next/link';
import { rpc, me } from '@/lib/api';
import { Empty } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { AdsTable } from '@/components/ads-table';
export const dynamic = 'force-dynamic';
const MON = (m: string) => new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(m));
export default async function Ads({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const u = await me(); if (!['owner', 'admin', 'account_manager'].includes(u.role)) return <Empty>זמין לבעלים ולמנהלי לקוחות בלבד.</Empty>;
  const { m } = await searchParams; const d = await rpc<any>('office_ads_overview', { p_month: m && /^\d{4}-\d{2}$/.test(m) ? `${m}-01` : null }).catch(() => null);
  if (!d) return <Empty>לא הצלחתי לטעון את נתוני הפרסום.</Empty>;
  const months: string[] = d.months ?? []; const cur = String(d.month).slice(0, 7);
  return <>
    <div className="hero"><h1>ביצועי <span className="mark">פרסום</span></h1>
      <p>נתוני מטא, גוגל אדס ו-Google Analytics לכל לקוח, נמשכים אוטומטית פעם ביום מהחשבונות שמחוברים בכרטיס הלקוח. {d.synced_at ? `עדכון אחרון: ${fmtDateTime(d.synced_at)}.` : ''} חודש נוכחי = מתחילת החודש עד אתמול.</p></div>
    <div className="tabs">{months.slice(0, 6).map((x) => { const k = String(x).slice(0, 7); return <Link key={k} href={`/ads?m=${k}`} className={k === cur ? 'on' : ''}>{MON(x)}</Link>; })}</div>
    <AdsTable rows={d.rows ?? []} />
  </>;
}
