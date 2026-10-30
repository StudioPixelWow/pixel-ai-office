import Link from 'next/link';
import { rpc, safeList } from '@/lib/api';
import { Hero, Badge, Contract } from '@/components/ui';
import { DEPARTMENTS } from '@/agents/roster';
import { he } from '@/lib/format';
export default async function Agents() {
  const [board, defs] = await Promise.all([rpc<any[]>('office_agent_board'), safeList<any>('agent_definitions', {}, 200)]);
  const av = Object.fromEntries(defs.map((d: any) => [d.id, d.avatar_blob_id]));
  return <>
    <Hero title={<>הסוכנים <span className="mark">שלי</span></>} sub="40 תפקידי פתיחה עם מפרט תפעולי מלא, גרסאות, כלים והרשאות. אפשר להוסיף תפקידים חדשים בסטודיו.">
      <Link className="btn k" href="/agents/new">סטודיו ליצירת סוכן</Link></Hero>
    {board.length ? Object.entries(board.reduce((g: Record<string, any[]>, a: any) => { (g[a.department] ??= []).push(a); return g; }, {})).map(([dep, list]) => <section key={dep} className="ag-sec">
      <h2>{DEPARTMENTS[dep as keyof typeof DEPARTMENTS] ?? dep} <span className="ag-n">{(list as any[]).length}</span></h2>
      <div className="ag-grid">{(list as any[]).map((a: any) => { const st = a.current?.status ?? 'available';
        return <Link key={a.id} href={`/agents/${a.id}`} className={`ag-card st-${st}`}>
          <span className="ag-av">{av[a.id] ? <img src={`/api/avatar/${av[a.id]}`} alt="" /> : (a.name ?? '?')[0]}</span>
          <span className="ag-tx"><b>{a.name}</b><small>{a.role_title ?? a.title ?? ''}</small></span>
          <span className="ag-meta"><i className={`ag-dot ${st}`} />{he(st)} · v{a.version}{a.status !== 'active' ? <> · <Badge s={a.status} /></> : null}</span>
        </Link>; })}</div></section>)
      : <div className="empty">הסוכנים טרם נטענו — טען אותם מהקמה ראשונית במסך הבית</div>}
    <Contract source="office_agent_board (agent_definitions + agent_versions + task_runs)" actions="פתיחת כרטיס, יצירה, שכפול, עריכה, השעיה, ארכוב" perms="עריכה: Owner/מנהל" empty="הנחיה לטעינת סוכנים" />
  </>;
}
