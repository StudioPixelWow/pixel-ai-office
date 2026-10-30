import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { claude, anthropicConfigured } from '@/engine/adapters/anthropic';
import { extractJson } from '@/engine/schemas';
import { tokenCost } from '@/engine/pricing';
import { heError } from '@/lib/errors';
export const maxDuration = 120;
const MODEL = process.env.SUMMARY_MODEL ?? 'claude-sonnet-5-5';
// Monthly performance report: facts from the office + ad/analytics metrics → client-facing summary (saved as draft; sharing is a separate click).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await params; const b = await req.json().catch(() => ({} as any));
  const month = /^\d{4}-\d{2}/.test(String(b.month ?? '')) ? `${String(b.month).slice(0, 7)}-01` : null;
  if (!month) return NextResponse.json({ error: 'חודש לא תקין' }, { status: 400 });
  if (!anthropicConfigured()) return NextResponse.json({ error: 'מודל ה-AI לא מחובר' }, { status: 400 });
  const sb = await supabaseServer();
  const [{ data: facts, error }, { data: client }] = await Promise.all([sb.rpc('office_report_facts', { p_client: id, p_month: month }), sb.rpc('office_get', { p_entity: 'clients', p_id: id })]);
  if (error || !facts) return NextResponse.json({ error: heError(error?.message ?? 'not_found') }, { status: 400 });
  const system = `את/ה מנהל/ת הלקוח במשרד הפרסום Pixel Digital וכותב/ת דוח חודשי ללקוח — בעברית, חם, מקצועי וענייני.
כללים: השתמש רק במספרים שמופיעים בנתונים. אל תמציא מספרים, אחוזים או השוואות שאין להן בסיס. אם חסרים נתוני פרסום — אל תתייחס אליהם כאילו קיימים.
החזר JSON בלבד: {"headline":"משפט פתיחה אחד שמסכם את החודש","highlights":["3–5 הישגים קונקרטיים"],"numbers":[{"label":"...","value":"..."}],"insights":["2–3 תובנות: מה עבד ולמה"],"next_month":["3 צעדים לחודש הבא"]}`;
  const user = `לקוח: ${(client as any)?.name ?? ''}${(client as any)?.industry ? ` (${(client as any).industry})` : ''}\nחודש: ${month.slice(0, 7)}\nנתונים:\n${JSON.stringify(facts)}`;
  try {
    const r = await claude({ model: MODEL, system, user, maxTokens: 2500 });
    await sb.rpc('office_log_usage', { p_client: id, p_agent: 'performance_analyst', p_model: r.model, p_in: r.usage.input, p_out: r.usage.output, p_cost: tokenCost(r.model, r.usage.input, r.usage.output), p_note: 'דוח חודשי' });
    const summary: any = extractJson(r.text); if (!summary?.headline) throw new Error('הדוח לא התקבל — נסה שוב');
    const s = await sb.rpc('office_action', { p_action: 'report_save', p_payload: { client_id: id, month, summary } });
    if (s.error) throw new Error(s.error.message);
    return NextResponse.json({ ok: true, summary });
  } catch (e: any) { return NextResponse.json({ error: heError(e?.message ?? e) }, { status: 502 }); }
}
