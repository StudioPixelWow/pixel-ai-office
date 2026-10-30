import Link from 'next/link';
import { rpc, safeList, me } from '@/lib/api';
import { Stat, Hero, Badge, Table, Contract, When, Empty } from '@/components/ui';
import { fmtUsd, fmtDateTime } from '@/lib/format';
import { SetupChecklist } from './setup-checklist';

export default async function Home() {
  const m = await me();
  const d = await rpc<any>('office_dashboard');
  const ws = await rpc<any>('office_worker_secret_status').catch(() => ({ registered: false }));
  const [waiting, stuck, due, conns, agents] = await Promise.all([
    safeList('task_runs', { status: 'waiting_approval' }, 8), safeList('task_runs', { status: ['waiting_connection', 'waiting_input', 'waiting_local', 'failed', 'uncertain'] }, 8),
    safeList('content_items', { _active: true }, 200), safeList('connections', {}, 50), safeList('agent_definitions', {}, 100),
  ]);
  const upcoming = due.filter((c: any) => c.due_at && new Date(c.due_at) > new Date() && c.production_status !== 'approved').slice(0, 8);
  return <>
    <Hero title={<>בוקר טוב, <span className="mark">PIXEL AI OFFICE</span></>} sub="מה ממתין לך, מה תקוע, מה יוצא השבוע — הכל נגזר מרשומות העבודה בפועל.">
      <Link className="btn k" href="/talk">דבר עם המשרד</Link></Hero>
    {m.role === 'owner' && <SetupChecklist agents={agents.length} conns={conns} worker={!!ws.registered} />}
    <div className="grid g4">
      <Stat n={d.waiting_me} label="ממתין לאישור שלי" href="/approvals" />
      <Stat n={d.stuck} label="משימות תקועות" href="/tasks?f=stuck" />
      <Stat n={d.running} label="בעבודה ובתור" href="/tasks?f=running" />
      <Stat n={d.due_7d} label="מסירות ב-7 הימים הקרובים" href="/planning" />
      <Stat n={d.active_clients} label="לקוחות פעילים" href="/clients" />
      <Stat n={d.open_leads} label="לידים פתוחים" href="/leads" />
      <Stat n={d.connections_attention} label="חיבורים שדורשים טיפול" href="/connections" />
      <Stat n={fmtUsd(d.usage_month_usd)} label="שימוש מדווח החודש" href="/usage" />
    </div>
    <div className="grid g2" style={{ marginTop: 16 }}>
      <div className="card"><h2>ממתין להחלטה שלך</h2>
        <Table head={['משימה', 'סוכן', 'עדכון']} rows={waiting.map((t: any) => [<Link key="l" href={`/tasks/${t.id}`}>{t.title}</Link>, t.agent_id, <When key="w" d={t.updated_at} />])} empty="אין פריטים שממתינים לך" /></div>
      <div className="card"><h2>תקוע / חסום</h2>
        <Table head={['משימה', 'מצב', 'סיבה']} rows={stuck.map((t: any) => [<Link key="l" href={`/tasks/${t.id}`}>{t.title}</Link>, <Badge key="b" s={t.status} />, <span key="s" className="small">{t.blocker}</span>])} empty="אין משימות תקועות" /></div>
      <div className="card"><h2>מסירות קרובות</h2>
        <Table head={['פריט', 'מועד', 'סטטוס']} rows={upcoming.map((c: any) => [c.topic, fmtDateTime(c.due_at), <Badge key="b" s={c.production_status} />])} empty="אין מסירות מתוכננות" /></div>
      <div className="card"><h2>Workers ומחשב מקומי</h2>
        {(d.workers ?? []).length ? <Table head={['Worker', 'נראה לאחרונה']} rows={(d.workers ?? []).map((x: any) => [x.worker_id, <When key="w" d={x.last_seen} />])} /> : <Empty>ה-Worker בענן טרם דיווח — הוא מופעל כל דקה ע״י Cron אחרי הפריסה</Empty>}
        <p className="small muted">Local Runner: {(d.runners ?? []).filter((r: any) => r.paired && !r.revoked).length ? 'מחובר' : 'לא מחובר — נדרש רק לרינדור וידאו ולמסלולי דפדפן מקומי'}</p></div>
    </div>
    <Contract source="office_dashboard + task_runs + content_items + connections" actions="לחיצה על כל מספר פותחת את הרשומות שמהן חושב" perms="כל משתמש רואה רק לקוחות בהיקף שלו; עלויות וחיבורים — Owner/מנהל" empty="מספר 0 ורשימה ריקה עם הסבר" />
  </>;
}
