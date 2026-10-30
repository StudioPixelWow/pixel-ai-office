import { NextResponse, type NextRequest } from 'next/server';
import { w } from '@/engine/db';
import { resolvePortal } from '@/lib/portal';
export const maxDuration = 60;
// Client onboarding checklist in the portal: state, mark a step done (with a note), questionnaire answers, file upload (≤10MB).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ t: string }> }) {
  const { t } = await params; const p = await resolvePortal(t); if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  try { return NextResponse.json(await w('office_worker_portal_onboarding', { p_client: p.client, p_action: 'state', p_key: null, p_payload: {} })); }
  catch { return NextResponse.json({ error: 'not_found' }, { status: 404 }); }
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ t: string }> }) {
  const { t } = await params; const p = await resolvePortal(t); if (!p) return NextResponse.json({ error: 'הקישור אינו בתוקף' }, { status: 404 });
  const b = await req.json().catch(() => ({} as any));
  if (!['mark', 'answers', 'upload'].includes(b.op)) return NextResponse.json({ error: 'bad_op' }, { status: 400 });
  if (b.op === 'upload' && String(b.b64 ?? '').length > 14_000_000) return NextResponse.json({ error: 'הקובץ גדול מדי (עד 10MB)' }, { status: 400 });
  const payload = b.op === 'answers' ? Object.fromEntries(Object.entries(b.answers ?? {}).map(([k, v]) => [k, String(v).slice(0, 2000)]))
    : b.op === 'upload' ? { mime: b.mime, b64: b.b64, name: String(b.name ?? '').slice(0, 120) } : { done: b.done !== false, note: String(b.note ?? '').slice(0, 500) };
  try { return NextResponse.json(await w('office_worker_portal_onboarding', { p_client: p.client, p_action: b.op, p_key: b.key ?? 'questionnaire', p_payload: payload })); }
  catch (e: any) { return NextResponse.json({ error: /bad_mime/.test(e.message) ? 'סוג קובץ לא נתמך — PDF, תמונה, ZIP או פונט' : 'לא הצלחנו לשמור, נסו שוב' }, { status: 400 }); }
}
