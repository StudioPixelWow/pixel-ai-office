import { NextResponse, type NextRequest } from 'next/server';
import { w } from '@/engine/db';
import { verifyPay, payUrl } from '@/lib/paytoken';
// Guest actions on their personal LOUD page: approve / ask for changes on the questions, open the payment, pick a studio slot.
const ERR: Record<string, string> = { slot_unavailable: 'המועד הזה נתפס הרגע — בחרו מועד אחר', pay_first: 'אפשר לבחור מועד אחרי התשלום', approve_first: 'צריך לאשר קודם את קובץ השאלות',
  feedback_required: 'כתבו לנו מה תרצו לשנות', not_reviewable: 'הקובץ כבר אושר' };
export async function POST(req: NextRequest, { params }: { params: Promise<{ t: string }> }) {
  const { t } = await params; const p = verifyPay(t); if (!p || p.k !== 'pod') return NextResponse.json({ error: 'הקישור אינו בתוקף' }, { status: 400 });
  const b = await req.json().catch(() => ({} as any)); const op = String(b.op ?? '');
  if (!['approve', 'changes', 'payment', 'slot'].includes(op)) return NextResponse.json({ error: 'פעולה לא מוכרת' }, { status: 400 });
  try {
    const r: any = await w('office_worker_studio_client', { p_id: p.id, p_op: op, p: { feedback: String(b.feedback ?? '').slice(0, 3000), slot_id: b.slot_id ?? null } });
    if (op === 'payment') return NextResponse.json({ ok: true, url: payUrl(req.nextUrl.origin, { k: 'pmt', id: r.payment_id }), status: r.status });
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) { const m = String(e?.message ?? ''); const k = Object.keys(ERR).find((x) => m.includes(x)); return NextResponse.json({ error: k ? ERR[k] : 'משהו השתבש — נסו שוב' }, { status: 400 }); }
}
