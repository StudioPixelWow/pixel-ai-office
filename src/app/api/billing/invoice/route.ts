import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { greenInvoiceConfigured, giCreateInvoiceReceipt } from '@/engine/adapters/greeninvoice';
import { heError } from '@/lib/errors';
// Owner/admin: issue a tax invoice-receipt (320) for a payment already marked paid. One invoice per payment.
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  if (!greenInvoiceConfigured()) return NextResponse.json({ error: 'חשבונית ירוקה לא מחוברת — חסרים מפתחות API בשרת' }, { status: 400 });
  const { payment_id } = await req.json(); const sb = await supabaseServer();
  const { data: p, error } = await sb.rpc('office_get', { p_entity: 'payments', p_id: payment_id });
  if (error || !p) return NextResponse.json({ error: heError(error?.message ?? 'not_found') }, { status: 400 });
  if (!['paid', 'partial'].includes(p.status) || !p.paid_at) return NextResponse.json({ error: 'אפשר להפיק חשבונית מס/קבלה רק לתשלום שסומן כשולם' }, { status: 400 });
  if (p.invoice_doc_id) return NextResponse.json({ error: 'כבר הופקה חשבונית לתשלום הזה' }, { status: 400 });
  const r = await giCreateInvoiceReceipt({ clientName: p.client_name, email: p.contact_email, phone: p.contact_phone,
    description: `${p.plan_title}${p.period_month ? ' — ' + String(p.period_month).slice(0, 7) : ''}`, netOrGrossAmount: Number(p.amount), vatMode: p.vat_mode,
    paidAmount: Number(p.paid_amount), paidAt: p.paid_at, method: p.method ?? 'other' }).catch((e) => ({ ok: false as const, error: String(e?.message ?? e) }));
  if (!r.ok) return NextResponse.json({ error: `חשבונית ירוקה: ${r.error}` }, { status: 502 });
  const rec = await sb.rpc('office_action', { p_action: 'payment_record_invoice', p_payload: { id: p.id, provider: 'green_invoice', doc_id: r.id, number: r.number, url: r.url } });
  if (rec.error) return NextResponse.json({ error: `החשבונית הופקה (${r.number ?? r.id}) אך לא נשמרה במערכת: ${heError(rec.error.message)}` }, { status: 500 });
  return NextResponse.json({ ok: true, number: r.number, url: r.url });
}
