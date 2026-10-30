import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { greenInvoiceConfigured, giCreateDocument, DOC_HE } from '@/engine/adapters/greeninvoice';
import { heError } from '@/lib/errors';
export const maxDuration = 60;
// Owner/admin: issue one accounting document for a payment, only after an explicit click with preview.
// 305 tax invoice (any open/paid payment) · 320 tax invoice-receipt (paid, nothing issued yet) · 400 receipt (paid; links to the 305 if one exists).
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  if (!greenInvoiceConfigured()) return NextResponse.json({ error: 'חשבונית ירוקה לא מחוברת' }, { status: 400 });
  const { payment_id, type } = await req.json(); const t = Number(type);
  if (![305, 320, 400].includes(t)) return NextResponse.json({ error: 'סוג מסמך לא נתמך' }, { status: 400 });
  const sb = await supabaseServer();
  const { data: st, error } = await sb.rpc('office_payment_doc_state', { p_payment: payment_id });
  if (error || !st?.payment) return NextResponse.json({ error: heError(error?.message ?? 'not_found') }, { status: 400 });
  const p = st.payment; const docs: any[] = st.docs ?? [];
  const hasInvoice = docs.some((d) => d.type === 305 || d.type === 320); const hasReceipt = docs.some((d) => d.type === 400 || d.type === 320);
  const paid = ['paid', 'partial'].includes(p.status) && p.paid_at;
  if (['waived', 'cancelled'].includes(p.status)) return NextResponse.json({ error: 'התשלום בוטל — אין להפיק מסמך' }, { status: 400 });
  if ((t === 305 || t === 320) && hasInvoice) return NextResponse.json({ error: 'כבר הופקה חשבונית לתשלום הזה' }, { status: 400 });
  if ((t === 320 || t === 400) && !paid) return NextResponse.json({ error: `${DOC_HE[t]} מופקת רק אחרי שהתשלום נרשם כשולם` }, { status: 400 });
  if ((t === 320 || t === 400) && hasReceipt) return NextResponse.json({ error: 'כבר הופקה קבלה לתשלום הזה' }, { status: 400 });
  const inv = docs.find((d) => d.type === 305);
  const r = await giCreateDocument({ type: t as any, clientName: p.client_name, email: p.contact_email, phone: p.contact_phone,
    description: `${p.plan_title}${p.period_month ? ' — ' + String(p.period_month).slice(0, 7) : ''}`, amount: Number(p.amount), vatMode: p.vat_mode,
    paid: paid ? { amount: Number(p.paid_amount), date: p.paid_at, method: p.method ?? 'other', reference: p.reference } : null,
    linkedDocIds: t === 400 && inv?.doc_id ? [inv.doc_id] : undefined }).catch((e) => ({ ok: false as const, error: String(e?.message ?? e) }));
  if (!r.ok) return NextResponse.json({ error: `חשבונית ירוקה: ${r.error}` }, { status: 502 });
  const rec = await sb.rpc('office_action', { p_action: 'payment_document_record', p_payload: { payment_id: p.id, type: t, provider: 'green_invoice', doc_id: r.id, number: r.number, url: r.url,
    amount: t === 305 ? (p.amount_gross ?? p.amount) : p.paid_amount, linked_doc_id: t === 400 && inv ? inv.id : null } });
  if (rec.error) return NextResponse.json({ error: `המסמך הופק (${r.number ?? r.id}) אך לא נשמר במערכת: ${heError(rec.error.message)}` }, { status: 500 });
  return NextResponse.json({ ok: true, number: r.number, url: r.url, label: DOC_HE[t] });
}
