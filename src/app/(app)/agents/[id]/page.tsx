import Link from 'next/link';
import { get, list, safeList } from '@/lib/api';
import { Badge, Table, When, Empty } from '@/components/ui';
import { ActionButton, ActionForm } from '@/components/client';
import { notFound } from 'next/navigation';

export default async function AgentCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const a = await get<any>('agent_definitions', id); if (!a) notFound();
  const [versions, tasks, clients] = await Promise.all([list('agent_versions', { agent_id: id }), safeList('task_runs', { agent_id: id }, 50), safeList('clients', { _active: true })]);
  const v = versions.find((x: any) => x.version_no === a.current_version) ?? versions[0]; const s = v?.spec ?? {};
  return <>
    <div className="hero"><div className="row">{a.avatar_blob_id && <img src={`/api/avatar/${a.avatar_blob_id}`} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', border: '4px solid #fff' }} />}
      <div className="sp"><h1>{a.name} · {a.role_title}</h1><p>{s.mission}</p></div><Badge s={a.status} />
      {a.status === 'active' ? <ActionButton className="btn" action="agent_set_status" payload={{ agent_id: id, status: 'paused' }}>השעה</ActionButton>
        : <ActionButton className="btn y" action="agent_set_status" payload={{ agent_id: id, status: 'active' }}>הפעל</ActionButton>}
      <ActionButton className="btn danger" action="agent_set_status" payload={{ agent_id: id, status: 'archived' }} confirm="לארכב את הסוכן?">ארכב</ActionButton></div></div>
    <div className="grid g2">
      <div className="card"><h2>מפרט תפעולי (v{v?.version_no})</h2><dl className="kv">
        <dt>תוצאה עסקית</dt><dd>{s.business_outcome}</dd><dt>סוגי משימות</dt><dd>{(s.task_types ?? []).join(' · ')}</dd>
        <dt>קלטים חובה</dt><dd>{(s.inputs_required ?? []).join(' · ')}</dd><dt>קלטים רצויים</dt><dd>{(s.inputs_optional ?? []).join(' · ') || '—'}</dd>
        <dt>מקורות ידע</dt><dd>{(s.knowledge ?? []).join(' · ')}</dd><dt>כלים</dt><dd>{(v?.tools ?? []).join(' · ')}</dd>
        <dt>סדר עבודה</dt><dd><ol style={{ margin: 0, paddingInlineStart: 18 }}>{(s.procedure ?? []).map((p: string) => <li key={p}>{p}</li>)}</ol></dd>
        <dt>מבנה התוצר</dt><dd>{s.output}</dd><dt>בדיקות איכות</dt><dd>{(s.quality_checks ?? []).join(' · ')}</dd><dt>תנאי סיום</dt><dd>{s.done_when}</dd>
        <dt>העברה</dt><dd>{s.handoff}</dd><dt>אליך כש…</dt><dd>{(s.escalate_to_owner ?? []).join(' · ') || '—'}</dd><dt>מגבלות</dt><dd>{s.limits}</dd>
        <dt>דוגמה טובה</dt><dd>{s.good_example}</dd><dt>כשל לזהות</dt><dd>{s.failure_to_detect}</dd><dt>מודל מועדף</dt><dd>{v?.preferred_model}</dd>
        <dt>יכולות נדרשות</dt><dd>{(v?.required_capabilities ?? []).join(', ')}</dd></dl></div>
      <div className="card"><h2>תן משימה</h2>
        <ActionForm action="assign_task" extra={{ agent_id: id, idempotency_key: `assign:${id}:${Date.now()}` }} submit="פתח משימה"
          fields={[{ name: 'client_id', label: 'לקוח', type: 'select', options: clients.map((c: any) => [c.id, c.name]) }, { name: 'instruction', label: 'המשימה', type: 'textarea', required: true }]} />
        <h2 style={{ marginTop: 20 }}>משימת ניסיון</h2>
        <ActionForm action="agent_test_run" extra={{ agent_id: id }} submit="הרץ ניסיון" fields={[{ name: 'task', label: 'משימת ניסיון מוגבלת', type: 'textarea', required: true, defaultValue: v?.eval_tasks?.[0]?.task }]} />
        <h2 style={{ marginTop: 20 }}>גרסאות</h2>
        <Table head={['גרסה', 'הערה', 'נוצר', '']} rows={versions.map((x: any) => [`v${x.version_no}`, x.change_note ?? '', <When key="w" d={x.created_at} />,
          x.version_no !== a.current_version ? <ActionButton key="r" className="btn sm" action="agent_set_status" payload={{ agent_id: id, rollback_to: x.version_no }}>חזור לגרסה</ActionButton> : <b key="c">נוכחית</b>])} />
        <p className="small"><Link href={`/agents/new?from=${id}`}>שכפל / ערוך כגרסה חדשה ←</Link></p></div></div>
    <div className="card" style={{ marginTop: 16 }}><h2>משימות ותוצרים</h2>
      {tasks.length ? <Table head={['משימה', 'מצב', 'חסם', 'עדכון']} rows={tasks.map((t: any) => [<Link key="l" href={`/tasks/${t.id}`}>{t.title}</Link>, <Badge key="b" s={t.status} />, <span key="x" className="small">{t.blocker ?? ''}</span>, <When key="w" d={t.updated_at} />])} /> : <Empty>טרם קיבל משימות</Empty>}</div>
  </>;
}
