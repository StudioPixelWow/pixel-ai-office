import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { w } from '@/engine/db';
import { toE164 } from '@/lib/loud';
import { brandedEmail, gmailConfigured, gmailSend } from '@/engine/adapters/gmail';
import { waLink } from '@/lib/wa';
export const maxDuration = 30;
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pixel-ai-office-iota.vercel.app';
const BRAND_HE: Record<string, string> = { loud: 'LOUD', pixel: 'פיקסל דיגיטל' };
// Tal asked (05.11.2026) for an email on every new inbound lead (Pixel + LOUD). Internal only, to Tal.
async function notifyLead(id: string, p: Record<string, string | null>, waText?: string | null) {
  if (!gmailConfigured()) return;
  const b = BRAND_HE[String(p.brand)] ?? 'ליד נכנס'; const who = p.name || p.business || p.phone_e164 || p.email || 'ליד';
  const lines = [`ליד חדש ל${b} נכנס למערכת.`, '', p.name && `שם: ${p.name}`, p.phone_e164 && `טלפון: ${p.phone_e164}`, p.email && `מייל: ${p.email}`, p.business && `עסק: ${p.business}`,
    p.message && `הודעה: ${p.message}`, p.source && `מקור: ${p.source}`, p.extra && `\nפרטים נוספים:\n${p.extra}`, '', `לפתיחת הליד: ${SITE}/leads/${id}`].filter((x): x is string => typeof x === "string");
  const text = lines.join('\n');
  const wa = waText ? waLink(p.phone_e164, waText) : null;
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
  const btn = wa ? `<div style="margin:22px 0 6px"><a href="${wa}" style="display:inline-block;background:#25D366;color:#fff;font-weight:bold;text-decoration:none;padding:13px 22px;border-radius:12px;font-size:16px">💬 פתיחת שיחה בוואטסאפ</a></div>`
    + `<div style="font-size:13px;color:#5B6B80;margin-bottom:6px">ההודעה שתיפתח מוכנה לשליחה (אפשר לערוך לפני ששולחים):</div>`
    + `<div style="white-space:pre-wrap;background:#F2FBF5;border:1px solid #CDEFD9;border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.7">${esc(waText!)}</div>` : '';
  const html = brandedEmail(text).replace('<!--sig-->', `${btn}<!--sig-->`);
  const r = await gmailSend({ to: 'tal.pixeld@gmail.com', subject: `🎯 ליד חדש · ${b} · ${who}`.slice(0, 200), html, text: wa ? `${text}\n\nפתיחת שיחה בוואטסאפ: ${wa}` : text });
  if (!r.ok) console.error('[lead-hook-mail]', r.error);
}
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
  try { const r: any = await w('office_worker_lead_hook', { p_token_hash: hash, p }); if (!r.duplicate) await notifyLead(r.id, p as any, r.wa_text).catch((e) => console.error('[lead-hook-mail]', e)); return NextResponse.json({ ok: true, id: r.id, duplicate: !!r.duplicate }); }
  catch (e: any) { const m = String(e?.message ?? ''); return NextResponse.json({ error: m.includes('bad_token') ? 'invalid' : m.includes('empty_lead') ? 'missing name/phone/email' : 'error' }, { status: m.includes('bad_token') ? 404 : 400 }); }
}
