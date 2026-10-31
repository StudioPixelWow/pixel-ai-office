import { NextResponse, type NextRequest } from 'next/server';
import nodemailer from 'nodemailer';
import { supabaseServer } from '@/lib/supabase/server';
import { accountFor } from '@/engine/inbox';
export const maxDuration = 60;
// Sends ONE reply, only on the user's explicit click (the UI asks to confirm first). From the same mailbox the email arrived to, threaded in Gmail.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const list = (s: string) => String(s ?? '').split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean).map((x) => x.match(/<([^>]+)>/)?.[1] ?? x);
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await ctx.params; const sb = await supabaseServer();
  const { data: m } = await sb.rpc('office_me'); if (!m || !['owner', 'admin', 'account_manager'].includes((m as any).role)) return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  const b = await req.json().catch(() => ({})); const to = list(b.to), cc = list(b.cc); const subject = String(b.subject ?? '').slice(0, 300); const body = String(b.body ?? '').trim();
  if (!to.length || [...to, ...cc].some((x) => !EMAIL.test(x))) return NextResponse.json({ error: 'כתובת נמען לא תקינה' }, { status: 400 });
  if (!body) return NextResponse.json({ error: 'אין תוכן לשליחה' }, { status: 400 });
  const { data: d, error } = await sb.rpc('office_inbox_email', { p_id: id }); if (error || !d) return NextResponse.json({ error: 'המייל לא נמצא' }, { status: 404 });
  const e = (d as any).email; const acc = accountFor(e.mailbox); if (!acc) return NextResponse.json({ error: `התיבה ${e.mailbox} לא מחוברת לשליחה` }, { status: 400 });
  const name = acc.user === String(process.env.GMAIL_USER).toLowerCase() ? (process.env.GMAIL_FROM_NAME || 'Pixel Digital · Studio Pixel') : (process.env.MAIL2_FROM_NAME || 'Tal · Pixel Digital');
  const refs = [e.refs, e.message_id].filter(Boolean).join(' ');
  try {
    const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: acc.user, pass: acc.pass } });
    const info = await t.sendMail({ from: { name, address: acc.user }, to, cc: cc.length ? cc : undefined, subject, text: body,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">${esc(body).replace(/\n/g, '<br>')}</div>`,
      inReplyTo: e.message_id?.startsWith('<') ? e.message_id : undefined, references: refs || undefined });
    await sb.rpc('office_inbox_sent', { p_id: id, p_to: to.join(', '), p_cc: cc.join(', '), p_subject: subject, p_body: body, p_message_id: info.messageId ?? null });
    return NextResponse.json({ ok: true });
  } catch (x: any) { return NextResponse.json({ error: `השליחה נכשלה: ${String(x?.message ?? x).slice(0, 160)}` }, { status: 500 }); }
}
