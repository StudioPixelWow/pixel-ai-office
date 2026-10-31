import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { claude } from '@/engine/adapters/anthropic';
import { w } from '@/engine/db';
import { tokenCost } from '@/engine/pricing';
export const maxDuration = 60;
// איריס drafts a reply — text only, returned to the editor. Nothing is sent from here.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await ctx.params; const sb = await supabaseServer();
  const { data: m } = await sb.rpc('office_me'); if (!m || !['owner', 'admin', 'account_manager'].includes((m as any).role)) return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const { data: d } = await sb.rpc('office_inbox_email', { p_id: id }); if (!d) return NextResponse.json({ error: 'המייל לא נמצא' }, { status: 404 });
  const e = (d as any).email; const thread = ((d as any).thread ?? []).slice(-4).map((t: any) => `${t.direction === 'out' ? 'אנחנו' : t.from_name || t.from_email}: ${String(t.body_text ?? '').slice(0, 1500)}`).join('\n---\n');
  const system = `את/ה כותב/ת טיוטת תשובה למייל בשם Pixel Digital (סטודיו פיקסל, משרד פרסום ודיגיטל). כתוב/כתבי בשפת המייל הנכנס (בדרך כלל עברית), בטון מקצועי, חם וקצר.
אל תבטיח/י מחירים, תאריכים או התחייבויות שלא מופיעים בהנחיה. אם חסר מידע, השאר/י [סוגריים מרובעים] לאדם שימלא. בלי שורת נושא, בלי חתימה מפורטת: סיים/י ב"בברכה,\\nטל".
החזר/י רק את גוף התשובה.`;
  const user = `${(d as any).client ? `לקוח: ${(d as any).client}\n` : ''}מאת: ${e.from_name ?? ''} <${e.from_email}>\nנושא: ${e.subject ?? ''}\n\nהמייל:\n${String(e.body_text ?? e.snippet ?? '').slice(0, 6000)}${thread ? `\n\nהתכתבות קודמת בשרשור:\n${thread}` : ''}${b.hint ? `\n\nהנחיה ממני לתשובה: ${String(b.hint).slice(0, 800)}` : ''}`;
  try {
    const r = await claude({ model: process.env.INBOX_DRAFT_MODEL || 'claude-sonnet-5-5', system, user, maxTokens: 900 });
    await w('office_worker_log_usage', { p_client: e.client_id ?? null, p_agent: 'inbox_triage', p_model: r.model, p_in: r.usage.input, p_out: r.usage.output, p_cost: tokenCost(r.model, r.usage.input, r.usage.output), p_note: 'טיוטת תשובה למייל' }).catch(() => null);
    return NextResponse.json({ text: r.text.trim() });
  } catch (x: any) { return NextResponse.json({ error: String(x?.message ?? x).slice(0, 160) }, { status: 500 }); }
}
