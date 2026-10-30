import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAnon } from '@/lib/supabase/anon';
import { growConfigured, growCreatePaymentLink } from '@/engine/adapters/grow';
// Signed client → one Grow payment link for the first charge (setup or first month), final amount only. Reused if it exists.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const sb = supabaseAnon();
  const { data: c, error } = await sb.rpc('office_public_payment_context', { p_token: token });
  if (error || !c) return NextResponse.json({ error: error?.message === 'sign_first' ? 'יש לחתום לפני התשלום' : 'הקישור אינו בתוקף' }, { status: 400 });
  const ctx: any = c; if (ctx.existing_link) return NextResponse.json({ url: ctx.existing_link });
  if (!growConfigured()) return NextResponse.json({ error: 'התשלום המקוון אינו זמין כרגע — ניצור איתך קשר להסדרת התשלום' }, { status: 400 });
  if (ctx.gross == null) return NextResponse.json({ error: 'סכום התשלום טרם הוגדר סופית — ניצור איתך קשר' }, { status: 400 });
  const r = await growCreatePaymentLink({ title: `${ctx.company} הצעת מחיר`, productName: ctx.kind === 'retainer' ? 'ריטיינר חודשי ראשון' : 'תשלום פרויקט',
    amount: Number(ctx.gross), fullName: ctx.contact_name || ctx.company, phone: ctx.phone, email: ctx.email, ref: `proposal:${ctx.id}`, successUrl: `${req.nextUrl.origin}/p/${token}` });
  if (!r.ok) return NextResponse.json({ error: 'לא ניתן ליצור תשלום כרגע — ניצור איתך קשר' }, { status: 502 });
  await sb.rpc('office_public_record_payment_link', { p_token: token, p_url: r.url });
  return NextResponse.json({ url: r.url });
}
