import { NextResponse, type NextRequest } from 'next/server';
import { w } from '@/engine/db';
import { resolvePortal } from '@/lib/portal';
// Client portal actions: approve a post, ask for changes, send a message. Each one notifies the office.
const ERR: Record<string, string> = { not_reviewable: 'הפוסט הזה כבר טופל', feedback_required: 'כתבו לנו מה תרצו לשנות', portal_invalid: 'הקישור אינו בתוקף', nps_recent: 'כבר קיבלנו ממך דירוג לאחרונה — תודה!', bad_score: 'בחרו ציון בין 0 ל-10' };
export async function POST(req: NextRequest, { params }: { params: Promise<{ t: string }> }) {
  const { t } = await params; const p = await resolvePortal(t); if (!p) return NextResponse.json({ error: 'הקישור אינו בתוקף' }, { status: 400 });
  const b = await req.json().catch(() => ({} as any)); const op = String(b.op ?? '');
  if (!['approve', 'changes', 'message', 'nps'].includes(op)) return NextResponse.json({ error: 'פעולה לא מוכרת' }, { status: 400 });
  try {
    const note = op === 'nps' ? `${Number(b.score)}|${String(b.note ?? '').slice(0, 2000)}` : String(b.note ?? '').slice(0, 3000);
    const r: any = await w('office_worker_portal_act', { p_client: p.client, p_rev: p.rev, p_op: op, p_item: b.id ?? null, p_note: note });
    return NextResponse.json({ ok: true, review_url: r?.review_url ?? null });
  } catch (e: any) { const m = String(e?.message ?? ''); const k = Object.keys(ERR).find((x) => m.includes(x)); return NextResponse.json({ error: k ? ERR[k] : 'משהו השתבש — נסו שוב' }, { status: 400 }); }
}
