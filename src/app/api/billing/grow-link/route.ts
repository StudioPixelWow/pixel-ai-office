import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { growConfigured } from '@/engine/adapters/grow';
import { payUrl } from '@/lib/paytoken';
import { heError } from '@/lib/errors';
// Owner/admin: create a Grow payment link for one scheduled payment. Requires a final amount (VAT resolved). Not sent automatically.
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  if (!growConfigured()) return NextResponse.json({ error: 'Grow לא מחובר — חסרים GROW_USER_ID ו-GROW_PAGE_CODE בשרת' }, { status: 400 });
  const { payment_id } = await req.json(); const sb = await supabaseServer();
  const { data: p, error } = await sb.rpc('office_get', { p_entity: 'payments', p_id: payment_id });
  if (error || !p) return NextResponse.json({ error: heError(error?.message ?? 'not_found') }, { status: 400 });
  if (p.amount_gross == null) return NextResponse.json({ error: 'אין סכום סופי כולל מע״מ — בחר תבנית מע״מ בהסדר' }, { status: 400 });
  if (['paid', 'waived', 'cancelled'].includes(p.status)) return NextResponse.json({ error: 'התשלום כבר סגור' }, { status: 400 });
  // Branded Pixel payment page; the Grow session itself is opened only when the payer clicks (it expires after a few minutes).
  const r = { url: payUrl(req.nextUrl.origin, { k: 'pmt', id: p.id }), ref: 'pixel-pay-page' };
  const rec = await sb.rpc('office_action', { p_action: 'payment_record_link', p_payload: { id: p.id, url: r.url, provider: 'grow', ref: r.ref } });
  if (rec.error) return NextResponse.json({ error: heError(rec.error.message) }, { status: 400 });
  return NextResponse.json({ ok: true, url: r.url });
}
