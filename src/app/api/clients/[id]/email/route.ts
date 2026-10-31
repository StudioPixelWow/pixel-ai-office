import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { sendFromMailbox } from '@/engine/mail-reply';
export const maxDuration = 60;
// A new email to a client — sent only on the user's explicit click, from office@, branded, logged on the client.
const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const list = (s: string) => String(s ?? '').split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean);
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await ctx.params; const sb = await supabaseServer();
  const { data: m } = await sb.rpc('office_me'); if (!m || !['owner', 'admin', 'account_manager'].includes((m as any).role)) return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  const b = await req.json().catch(() => ({})); const to = list(b.to), cc = list(b.cc); const subject = String(b.subject ?? '').trim().slice(0, 300); const body = String(b.body ?? '').trim();
  if (!to.length || [...to, ...cc].some((x) => !EMAIL.test(x))) return NextResponse.json({ error: 'כתובת נמען לא תקינה' }, { status: 400 });
  if (!subject || !body) return NextResponse.json({ error: 'חסר נושא או תוכן' }, { status: 400 });
  const office = String(process.env.GMAIL_USER ?? '').toLowerCase();
  try {
    const mid = await sendFromMailbox(office, { to, cc, subject, text: body });
    await sb.rpc('office_client_email_sent', { p_client: id, p_to: to.join(', '), p_cc: cc.join(', '), p_subject: subject, p_body: body, p_message_id: mid ?? null, p_mailbox: office });
    return NextResponse.json({ ok: true });
  } catch (x: any) { return NextResponse.json({ error: `השליחה נכשלה: ${String(x?.message ?? x).slice(0, 160)}` }, { status: 500 }); }
}
