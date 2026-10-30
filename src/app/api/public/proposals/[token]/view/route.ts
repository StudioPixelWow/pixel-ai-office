import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAnon } from '@/lib/supabase/anon';
import { gmailConfigured, gmailSend } from '@/engine/adapters/gmail';
// Public proposal page pings: first ping opens a view (and alerts the office if nobody looked in the last 30 min), later pings extend reading time.
// Internal email goes only to the office inbox — never to the client.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const b = await req.json().catch(() => ({}));
  if (/bot|crawl|spider|preview|facebookexternalhit|whatsapp|slackbot|telegram/i.test(req.headers.get('user-agent') ?? '')) return NextResponse.json({ ok: true, skipped: 'bot' });
  const { data, error } = await supabaseAnon().rpc('office_proposal_view_ping', { p_token: token, p_view: b.view ?? null, p_ua: req.headers.get('user-agent') ?? '' });
  if (error) return NextResponse.json({ ok: false }, { status: 200 });
  const d: any = data;
  if (d?.alert && gmailConfigured() && process.env.GMAIL_USER) {
    const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin}/proposals/${d.proposal_id}`;
    await gmailSend({ to: process.env.GMAIL_USER, subject: `🔥 ${d.who} פתח/ה עכשיו את הצעת המחיר`, text: `${d.who} פתח/ה עכשיו את ההצעה "${d.title}". זה הזמן להתקשר.\n${url}`,
      html: `<div dir="rtl" style="font-family:Arial"><h2>🔥 ${d.who} פתח/ה עכשיו את הצעת המחיר</h2><p>ההצעה: <b>${d.title}</b></p><p>זה הזמן הכי טוב להתקשר.</p><p><a href="${url}">לפתיחת ההצעה במערכת</a></p></div>` }).catch(() => null);
  }
  return NextResponse.json({ ok: true, view: d?.view_id ?? null });
}
