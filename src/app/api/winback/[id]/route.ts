import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { claude, anthropicConfigured } from '@/engine/adapters/anthropic';
import { extractJson } from '@/engine/schemas';
import { tokenCost } from '@/engine/pricing';
import { heError } from '@/lib/errors';
export const maxDuration = 90;
const MODEL = process.env.SUMMARY_MODEL ?? 'claude-sonnet-5-5';
// Win-back: one personal message to a past client (preview first; saving creates an approval-gated draft — nothing is sent from here).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await params; const b = await req.json().catch(() => ({} as any)); const sb = await supabaseServer();
  if (b.save) { const { data, error } = await sb.rpc('office_action', { p_action: 'winback_draft_save', p_payload: { id, body: String(b.body ?? '').slice(0, 1500) } });
    return error ? NextResponse.json({ error: heError(error.message) }, { status: 400 }) : NextResponse.json(data); }
  if (!anthropicConfigured()) return NextResponse.json({ error: 'מודל ה-AI לא מחובר' }, { status: 400 });
  const { data: all } = await sb.rpc('office_winback'); const w = (all as any[] ?? []).find((x) => x.id === id);
  if (!w) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 });
  const month = new Intl.DateTimeFormat('he-IL', { month: 'long', timeZone: 'Asia/Jerusalem' }).format(new Date());
  const system = `את/ה טל, הבעלים של משרד הפרסום Pixel Digital. כותב/ת הודעת וואטסאפ אישית, חמה וקצרה (עד 70 מילה) ללקוח עבר.
בלי להישמע כמו פרסומת, בלי לחץ, בלי הבטחות מספריות. התייחס/י למה שעשינו יחד, ותן/י רעיון אחד קונקרטי ורלוונטי לעסק שלו עכשיו (${month}, עונתיות, מגמה בתחום).
סיים/י בשאלה פתוחה קלה (למשל "בא לך שנקבע 10 דקות טלפון?"). פתח/י ב"היי {name}". אל תמציא/י עובדות על העסק שלא נמסרו.
החזר JSON בלבד: {"body":"...","idea":"הרעיון במשפט"}`;
  const user = `שם: ${w.name}\nעסק: ${w.business ?? '—'}\nמה עשינו בעבר: ${w.past_service ?? '—'}\nמתי הסתיים: ${w.ended ?? '—'}\nאתר: ${w.website ?? '—'}\nהערות שלי: ${w.notes ?? '—'}\nהנחיה נוספת: ${String(b.hint ?? '').slice(0, 300) || '—'}`;
  try {
    const r = await claude({ model: MODEL, system, user, maxTokens: 700 });
    await sb.rpc('office_log_usage', { p_client: null, p_agent: 'crm_followup', p_model: r.model, p_in: r.usage.input, p_out: r.usage.output, p_cost: tokenCost(r.model, r.usage.input, r.usage.output), p_note: 'החזרת לקוח עבר' });
    const d: any = extractJson(r.text); if (!d?.body) throw new Error('ההודעה לא התקבלה — נסה שוב');
    return NextResponse.json({ body: d.body, idea: d.idea });
  } catch (e: any) { return NextResponse.json({ error: heError(e) }, { status: 502 }); }
}
