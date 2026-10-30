import Link from 'next/link';
import { get, list, safeList } from '@/lib/api';
import { Badge, When, Empty } from '@/components/ui';
import { ActionButton } from '@/components/client';
import { he, fmtDateTime } from '@/lib/format';
import { notFound } from 'next/navigation';

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const t = await get<any>('task_runs', id); if (!t) notFound();
  const [steps, arts, usage] = await Promise.all([t.workflow_run_id ? list('task_runs', { workflow_run_id: t.workflow_run_id }) : Promise.resolve([t]),
    safeList('artifacts', { id: t.output_artifact_ids ?? [] }), safeList('usage_entries', { task_run_id: id })]);
  steps.sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
  const waitingVersions: string[] = t.inputs?.awaiting_versions ?? [];
  return <>
    <div className="hero"><div className="row"><div className="sp"><h1>{t.title}</h1><p>{t.agent_id ?? '—'} · {t.step_key} · {he(t.inputs?.kind)}</p></div><Badge s={t.status} /></div></div>
    <div className="grid g2">
      <div className="card"><h2>מצב הריצה</h2><dl className="kv">
        <dt>שלב</dt><dd>{t.stage ?? '—'}</dd><dt>פעולה אחרונה</dt><dd>{t.last_action ?? '—'}</dd><dt>חסם</dt><dd>{t.blocker ?? '—'}</dd>
        <dt>ניסיונות</dt><dd>{t.attempts}/{t.max_attempts}</dd><dt>מודל</dt><dd>{t.model ?? '—'}</dd><dt>גרסת הגדרה</dt><dd>v{t.agent_version ?? '—'}</dd>
        <dt>התחיל</dt><dd>{fmtDateTime(t.started_at)}</dd><dt>הסתיים</dt><dd>{fmtDateTime(t.finished_at)}</dd>
        <dt>עלות מדווחת</dt><dd>{usage.length ? usage.map((u: any) => <div key={u.id} className="small">{u.provider} {u.model}: {u.input_units ?? 0}/{u.output_units ?? 0} יח׳ · {u.cost_usd === null ? 'עלות לא דווחה ע״י הספק' : `$${u.cost_usd}`} ({u.cost_kind})</div>) : 'אין'}</dd></dl>
        <div className="row" style={{ marginTop: 12 }}>
          {['failed', 'waiting_connection', 'waiting_local', 'waiting_input', 'uncertain'].includes(t.status) && <ActionButton className="btn y" action="retry_task" payload={{ task_run_id: t.id }}>נסה שוב (מבוקר)</ActionButton>}
          {!['done', 'cancelled', 'running'].includes(t.status) && <ActionButton className="btn danger" action="cancel_run" payload={{ task_run_id: t.id }} confirm="לבטל את השלב הזה?">בטל שלב</ActionButton>}
          {t.workflow_run_id && <ActionButton className="btn danger" action="cancel_run" payload={{ workflow_run_id: t.workflow_run_id }} confirm="לבטל את כל התהליך? תוצרים קיימים יישמרו.">בטל תהליך</ActionButton>}</div></div>
      <div className="card"><h2>שלבי התהליך</h2><div className="steps">{steps.map((s: any, i: number) => <div key={s.id} className={`step ${s.status}`}><div className="num">{i + 1}</div>
        <div className="sp"><Link href={`/tasks/${s.id}`}><b>{s.title}</b></Link><div className="small muted">{s.agent_id} · {s.stage}{s.blocker ? ` · ${s.blocker}` : ''}</div></div><Badge s={s.status} /></div>)}</div></div>
    </div>
    {t.status === 'waiting_approval' && <div className="card" style={{ marginTop: 16 }}><h2>ממתין להחלטה שלך</h2>
      {t.inputs?.kind === 'gate:proposal' ? <p>פתח את <Link href={`/proposals/${t.inputs?.params?.proposal_id}`}>ההצעה</Link> כדי לאשר גרסה.</p>
        : waitingVersions.length ? waitingVersions.map((v) => <div key={v} className="row" style={{ marginBottom: 8 }}><span className="sp small">גרסת תוצר {v.slice(0, 8)}</span>
          <ActionButton className="btn y sm" action="approve_artifact" payload={{ version_id: v, approval_kind: 'general' }}>אשר תוצר</ActionButton></div>) : <Empty>אין תוצרים לאישור בשלב הזה</Empty>}</div>}
    <div className="card" style={{ marginTop: 16 }}><h2>תוצרים</h2>{arts.length ? arts.map((a: any) => <div key={a.id}><Link href={`/studio/${a.id}`}>{a.title}</Link> · {a.kind} · גרסה {a.current_version}</div>) : <Empty>טרם נוצרו תוצרים</Empty>}</div>
    <div className="card" style={{ marginTop: 16 }}><h2>פלט מובנה</h2><pre className="out">{t.outputs ? JSON.stringify(t.outputs, null, 2) : '—'}</pre>
      <p className="small muted">מוצגים תקצירי פעולות ותוצרים — לא חשיבה פנימית של המודל.</p></div>
  </>;
}
