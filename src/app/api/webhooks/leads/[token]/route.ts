import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { w } from '@/engine/db';
import { toE164 } from '@/lib/loud';
export const dynamic = 'force-dynamic';
// Inbound leads from Make / Zapier / forms: POST JSON or form fields to /api/webhooks/leads/<token>?brand=loud.
// Common field names (English or Hebrew) are recognised; anything else is kept on the lead as extra details.
const pick = (o: Record<string, any>, keys: string[]) => { for (const k of Object.keys(o)) { const n = k.toLowerCase().replace(/[\s_\-:]+/g, ''); if (keys.includes(n)) { const v = String(o[k] ?? '').trim(); if (v) return { k, v }; } } return null; };
const NAME = ['name', 'fullname', 'contactname', 'firstname', 'שם', 'שםמלא', 'שםפרטי'], PHONE = ['phone', 'phonenumber', 'mobile', 'tel', 'telephone', 'טלפון', 'נייד', 'מספרטלפון'],
  EMAIL = ['email', 'mail', 'emailaddress', 'מייל', 'אימייל', 'דואל'], BIZ = ['business', 'company', 'businessname', 'companyname', 'עסק', 'שםהעסק', 'חברה'],
  MSG = ['message', 'notes', 'note', 'comments', 'הודעה', 'הערות', 'פרטים'], SRC = ['source', 'campaign', 'campaignname', 'adname', 'form', 'formname', 'מקור', 'קמפיין'], LAST = ['lastname', 'שםמשפחה'];
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) return NextResponse.json({ error: 'invalid' }, { status: 404 });
  let body: Record<string, any> = {};
  const ct = req.headers.get('content-type') ?? '';
  try { if (ct.includes('application/json')) body = await req.json(); else { const f = await req.formData(); f.forEach((v, k) => { body[k] = String(v); }); } } catch { body = {}; }
  if (Array.isArray(body)) body = body[0] ?? {};
  const used = new Set<string>(); const take = (keys: string[]) => { const r = pick(body, keys); if (r) used.add(r.k); return r?.v ?? ''; };
  const first = take(NAME), last = take(LAST); const name = [first, last].filter(Boolean).join(' ');
  const rawPhone = take(PHONE); const email = take(EMAIL); const business = take(BIZ); const message = take(MSG); const source = take(SRC);
  const brand = (req.nextUrl.searchParams.get('brand') ?? String(body.brand ?? '')).trim().toLowerCase(); used.add('brand');
  const extra = Object.entries(body).filter(([k, v]) => !used.has(k) && v != null && String(v).trim() && typeof v !== 'object').slice(0, 30).map(([k, v]) => `${k}: ${String(v).slice(0, 300)}`).join('\n');
  const p = { name: name.slice(0, 120), phone_e164: toE164(rawPhone) ?? (rawPhone ? rawPhone.replace(/[^\d+]/g, '').slice(0, 20) : null), email: email.slice(0, 160), business: business.slice(0, 160),
    message: message.slice(0, 2000), source: source.slice(0, 40), extra: extra.slice(0, 4000), brand };
  const hash = createHash('sha256').update(token).digest('hex');
  try { const r: any = await w('office_worker_lead_hook', { p_token_hash: hash, p }); return NextResponse.json({ ok: true, id: r.id, duplicate: !!r.duplicate }); }
  catch (e: any) { const m = String(e?.message ?? ''); return NextResponse.json({ error: m.includes('bad_token') ? 'invalid' : m.includes('empty_lead') ? 'missing name/phone/email' : 'error' }, { status: m.includes('bad_token') ? 404 : 400 }); }
}
