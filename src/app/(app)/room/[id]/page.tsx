import { notFound } from 'next/navigation';
import { get, list, safeList } from '@/lib/api';
import { WorkRoom } from './work-room';
import { LiveRefresh } from '../live-refresh';
export const dynamic = 'force-dynamic';
// The work room: one request around a table — every participating agent, its live state, and what it is doing for us.
export default async function Room({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const req = await get<any>('requests', id); if (!req) notFound();
  const [tasks, defs, events] = await Promise.all([list<any>('task_runs', { request_id: id }, 300), safeList<any>('agent_definitions', {}, 200), safeList<any>('task_events', { request_id: id }, 300)]);
  const artIds = [...new Set(tasks.flatMap((t) => t.output_artifact_ids ?? []))];
  const [arts, usage] = await Promise.all([artIds.length ? safeList<any>('artifacts', { id: artIds }, 200) : Promise.resolve([]), safeList<any>('usage_entries', { task_run_id: tasks.map((t) => t.id) }, 500)]);
  const agents = Object.fromEntries(defs.map((d) => [d.id, { id: d.id, name: d.name, role: d.role_title, avatar: d.avatar_blob_id, department: d.department }]));
  const live = tasks.some((t) => !['done', 'cancelled', 'failed'].includes(t.status));
  return <>{live && <LiveRefresh ms={4000} />}<WorkRoom request={{ id: req.id, text: req.text, status: req.status, created_at: req.created_at, answer: req.answer, client_id: tasks.find((t) => t.client_id)?.client_id ?? null, research: tasks.some((t) => t.inputs?.kind === 'tool:save_dossier'), content: tasks.some((t) => t.inputs?.kind === 'tool:save_content_plan'), month: tasks.find((t) => t.inputs?.params?.month)?.inputs?.params?.month ?? null, proposal_id: tasks.find((t) => t.proposal_id)?.proposal_id ?? null }}
    tasks={tasks.map((t) => ({ id: t.id, title: t.title, step: t.step_key, agent: t.agent_id, status: t.status, stage: t.stage, last_action: t.last_action, blocker: t.blocker, depends_on: t.depends_on ?? [],
      started_at: t.started_at, finished_at: t.finished_at, created_at: t.created_at, outputs: t.outputs, artifacts: t.output_artifact_ids ?? [], attempts: t.attempts, kind: t.inputs?.kind }))}
    agents={agents} events={events.map((e) => ({ id: e.id, task: e.task_run_id, agent: e.agent_id, kind: e.kind, message: e.message, at: e.created_at }))}
    artifacts={Object.fromEntries(arts.map((a) => [a.id, { id: a.id, title: a.title, kind: a.kind, version: a.current_version }]))}
    usage={usage.map((u) => ({ task: u.task_run_id, provider: u.provider, model: u.model, cost: u.cost_usd, inp: u.input_units, out: u.output_units }))} /></>;
}
