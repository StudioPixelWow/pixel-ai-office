import Link from 'next/link';
import { safeList } from '@/lib/api';
import { Hero, Badge, Table, When, Contract, Tabs } from '@/components/ui';
const F: Record<string, any> = { all: {}, running: { status: ['running', 'queued', 'retrying'] }, stuck: { status: ['waiting_connection', 'waiting_input', 'waiting_local', 'failed', 'uncertain'] },
  approval: { status: 'waiting_approval' }, done: { status: 'done' } };
export default async function Tasks({ searchParams }: { searchParams: Promise<{ f?: string; client?: string; agent?: string }> }) {
  const sp = await searchParams; const f = { ...(F[sp.f ?? 'all'] ?? {}) }; if (sp.client) f.client_id = sp.client; if (sp.agent) f.agent_id = sp.agent;
  const [tasks, clients, wfs] = await Promise.all([safeList('task_runs', f, 300), safeList('clients'), safeList('workflow_runs', {}, 100)]);
  const cn = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
  return <>
    <Hero title={<>משימות <span className="mark">ותהליכי עבודה</span></>} sub="כל שלב הוא רשומה במנוע: תלויות, ניסיונות, חסמים ועלות — בלי אחוזי התקדמות מומצאים." />
    <Tabs on={`/tasks?f=${sp.f ?? 'all'}`} items={[['/tasks?f=all', 'הכל'], ['/tasks?f=running', 'בעבודה'], ['/tasks?f=stuck', 'תקוע'], ['/tasks?f=approval', 'ממתין לאישור'], ['/tasks?f=done', 'הושלם']]} />
    <Table head={['משימה', 'לקוח', 'סוכן', 'מצב', 'שלב', 'ניסיונות', 'עדכון']} rows={tasks.map((t: any) => [<Link key="l" href={`/tasks/${t.id}`}>{t.title}</Link>, cn[t.client_id] ?? 'Pixel', t.agent_id ?? '—',
      <Badge key="b" s={t.status} />, <span key="s" className="small">{t.stage}{t.blocker ? ` · ${t.blocker}` : ''}</span>, `${t.attempts}/${t.max_attempts}`, <When key="w" d={t.updated_at} />])} empty="אין משימות בסינון הזה" />
    <h2 style={{ marginTop: 22 }}>תהליכים</h2>
    <Table head={['תהליך', 'לקוח', 'מצב', 'נוצר']} rows={wfs.map((w: any) => [w.workflow_key, cn[w.client_id] ?? 'Pixel', <Badge key="b" s={w.status} />, <When key="w" d={w.created_at} />])} />
    <Contract source="office.task_runs / workflow_runs" actions="פתיחת ריצה, ניסיון חוזר מבוקר, ביטול" perms="לפי היקף לקוח" empty="אין משימות" />
  </>;
}
