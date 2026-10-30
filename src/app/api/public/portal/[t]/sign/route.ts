import { NextResponse, type NextRequest } from 'next/server';
import { w } from '@/engine/db';
import { resolvePortal } from '@/lib/portal';
// Digital signature from the client portal: typed name + drawn signature, with time, IP and device recorded.
const ERR: Record<string, string> = { not_signable: 'המסמך הזה כבר נחתם או אינו זמין לחתימה', name_required: 'נא לכתוב שם מלא', signature_required: 'נא לחתום במסגרת' };
export async function POST(req: NextRequest, { params }: { params: Promise<{ t: string }> }) {
  const { t } = await params; const p = await resolvePortal(t); if (!p) return NextResponse.json({ error: 'הקישור אינו בתוקף' }, { status: 400 });
  const b = await req.json().catch(() => ({} as any));
  if (!b.agree) return NextResponse.json({ error: 'יש לאשר את הסכמתך לתנאי המסמך' }, { status: 400 });
  const sig = String(b.signature ?? '').replace(/^data:image\/png;base64,/, '');
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  try {
    await w('office_worker_portal_sign', { p_client: p.client, p_rev: p.rev, p_doc: String(b.id ?? ''), p_name: String(b.name ?? '').slice(0, 120), p_sig_b64: sig, p_ip: ip, p_ua: req.headers.get('user-agent') ?? '' });
    return NextResponse.json({ ok: true });
  } catch (e: any) { const m = String(e?.message ?? ''); const k = Object.keys(ERR).find((x) => m.includes(x)); return NextResponse.json({ error: k ? ERR[k] : 'החתימה לא נשמרה — נסו שוב' }, { status: 400 }); }
}
