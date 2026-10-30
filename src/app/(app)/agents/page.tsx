import Link from 'next/link';
import { rpc, safeList } from '@/lib/api';
import { Hero, Table, Badge, Contract } from '@/components/ui';
import { DEPARTMENTS } from '@/agents/roster';
import { he } from '@/lib/format';
export default async function Agents() {
  const [board, defs] = await Promise.all([rpc<any[]>('office_agent_board'), safeList<any>('agent_definitions', {}, 200)]);
  const av = Object.fromEntries(defs.map((d: any) => [d.id, d.avatar_blob_id]));
  return <>
    <Hero title={<>הסוכנים <span className="mark">שלי</span></>} sub="40 תפקידי פתיחה עם מפרט תפעולי מלא, גרסאות, כלים והרשאות. אפשר להוסיף תפקידים חדשים בסטודיו.">
      <Link className="btn k" href="/agents/new">סטודיו ליצירת סוכן</Link></Hero>
    <Table head={['#', 'שם', 'תפקיד', 'מחלקה', 'סטטוס', 'מצב עבודה', 'גרסה', 'יכולות נדרשות']} rows={board.map((a: any) => [a.number, <Link key="l" href={`/agents/${a.id}`} className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>{av[a.id] ? <img className="avi" src={`/api/avatar/${av[a.id]}`} alt="" loading="lazy" /> : <span className="avi" />}<b>{a.name}</b></Link>, a.role_title,
      DEPARTMENTS[a.department as keyof typeof DEPARTMENTS] ?? a.department, <Badge key="s" s={a.status} />, he(a.current?.status ?? 'available'), `v${a.version}`, (a.required_capabilities ?? []).join(', ')])}
      empty="הסוכנים טרם נטענו — טען אותם מהקמה ראשונית במסך הבית" />
    <Contract source="office_agent_board (agent_definitions + agent_versions + task_runs)" actions="פתיחת כרטיס, יצירה, שכפול, עריכה, השעיה, ארכוב" perms="עריכה: Owner/מנהל" empty="הנחיה לטעינת סוכנים" />
  </>;
}
