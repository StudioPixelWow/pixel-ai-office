import { NextResponse, type NextRequest } from 'next/server';
import { w } from '@/engine/db';
// Kling callback carries no signature, so it is treated only as a hint: it updates a job we already know (by task id) and the
// worker re-verifies status by polling before using any result. Unknown task ids are ignored.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const id = b?.task_id ?? b?.data?.task_id; if (!id) return NextResponse.json({ ignored: true });
  const st = b?.task_status ?? b?.data?.task_status;
  await w('office_provider_event', { p_provider: 'kling', p_event_id: `kling:${id}:${st}`, p_payload: { type: 'job_status', provider_job_id: id, status: st === 'succeed' ? 'processing' : st === 'failed' ? 'processing' : 'processing' } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
