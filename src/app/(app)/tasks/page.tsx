import Link from 'next/link';
import { safeList } from '@/lib/api';
import { Hero, Badge, Tabs } from '@/components/ui';
import { ROSTER } from '@/agents/roster';
const F: Record<string, any> = { all: {}, running: { status: ['running', 'queued', 'retrying'] }, stuck: { status: ['waiting_connection', 'waiting_input', 'waiting_local', 'failed', 'uncertain'] },
  approval: { status: 'waiting_approval' }, done: { status: 'done' } };
const AG = Object.fromEntries(ROSTER.map((a) => [a.id, a]));
const ago = (d: string) => { const m = (Date.now() - +new Date(d)) / 6e4; return m < 1 ? 'עכשיו' : m < 60 ? `לפני ${Math.round(m)} דק׳` : m < 1440 ? `לפני ${Math.round(m / 60)} שע׳` : `לפני ${Math.round(m / 1440)} ימים`; };
const WF: Record<string, string> = { client_research: 'מחקר לקוח', content_month: 'גאנט תוכן חודשי', podcast_prep: 'LOUD · הכנת ראיון', single_agent: 'משימה לסוכן', proposal: 'הצעת מחיר' };
export default async function Tasks({ searchParams }: { searchParams: Promise<{ f?: string; client?: string; agent?: string }> }) {
  const sp = await searchParams; const f = { ...(F[sp.f ?? 'all'] ?? {}) }; if (sp.client) f.client_id = sp.client; if (sp.agent) f.agent_id = sp.agent;
  const [tasks, clients, wfs, stuck] = await Promise.all([safeList<any>('task_runs', f, 300), safeList<any>('clients', {}, 500), safeList<any>('workflow_runs', {}, 60), safeList<any>('task_runs', F.stuck, 100)]);
  const cn = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
  const running = tasks.filter((t) => ['running', 'queued', 'retrying'].includes(t.status)).length;
  return <>
    <Hero title={<>משימות <span className="mark">ותהליכי עבודה</span></>} sub="כל שלב שהסוכנים מבצעים: מי עובד על מה, מה תקוע ומה מחכה לך." />
    <div className="kpis">
      <div className="kpi"><b>{running}</b><span>בעבודה עכשיו</span></div>
      <div className={`kpi${stuck.length ? ' hot' : ''}`}><b>{stuck.length}</b><span>תקועות / צריכות משהו</span></div>
      <div className="kpi"><b>{tasks.filter((t) => t.status === 'waiting_approval').length}</b><span>ממתינות לאישור</span></div>
      <div className="kpi"><b>{tasks.filter((t) => t.status === 'done').length}</b><span>הושלמו (בסינון)</span></div>
      <div className="kpi"><b>{wfs.filter((w: any) => w.status === 'running').length}</b><span>תהליכים פעילים</span></div>
    </div>
    <Tabs on={`/tasks?f=${sp.f ?? 'all'}`} items={[['/tasks?f=all', 'הכל'], ['/tasks?f=running', 'בעבודה'], ['/tasks?f=stuck', 'תקוע'], ['/tasks?f=approval', 'ממתין לאישור'], ['/tasks?f=done', 'הושלם']]} />
    {tasks.length ? <div className="tlist">{tasks.map((t: any) => { const a = AG[t.agent_id];
      return <Link key={t.id} href={`/tasks/${t.id}`} scroll={false} className={`trow s-${t.status}`}>
        <span className="av">{a?.name?.[0] ?? '•'}</span>
        <div className="trow-t"><b>{t.title}</b><small>{a ? `${a.name} · ${a.role_title}` : t.agent_id ?? '—'} · {cn[t.client_id] ?? 'Pixel'}</small>{(t.stage || t.blocker) && <em>{t.blocker ? `⚠ ${t.blocker}` : t.stage}</em>}</div>
        <div className="trow-m"><Badge s={t.status} /><small>{ago(t.updated_at)}{t.attempts > 1 ? ` · ניסיון ${t.attempts}/${t.max_attempts}` : ''}</small></div>
      </Link>; })}</div> : <div className="empty">אין משימות בסינון הזה</div>}
    <h2 style={{ marginTop: 24 }}>תהליכים אחרונים</h2>
    <div className="wf-grid">{wfs.slice(0, 18).map((w: any) => <Link key={w.id} href={w.request_id ? `/room/${w.request_id}` : '#'} className="wf-card"><b>{WF[w.workflow_key] ?? w.workflow_key}</b><small>{cn[w.client_id] ?? 'Pixel'} · {ago(w.created_at)}</small><Badge s={w.status} /></Link>)}</div>
    {stuck.length > 0 && sp.f === 'stuck' && <p className="small muted" style={{ marginTop: 10 }}>לחיצה על משימה תקועה פותחת אותה — שם אפשר לנסות שוב או לבטל.</p>}
  </>;
}
