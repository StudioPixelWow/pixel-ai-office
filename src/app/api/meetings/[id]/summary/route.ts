import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { claude, anthropicConfigured } from '@/engine/adapters/anthropic';
import { extractJson } from '@/engine/schemas';
import { tokenCost } from '@/engine/pricing';
import { heError } from '@/lib/errors';
export const maxDuration = 120;
const MODEL = process.env.SUMMARY_MODEL ?? 'claude-sonnet-5-5';
// Meeting notes → summary, decisions, action items (ours become calendar tasks) and a client message draft (approval-gated).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await params; const b = await req.json().catch(() => ({} as any)); const notes = String(b.notes ?? '').trim().slice(0, 20000);
  if (notes.length < 20) return NextResponse.json({ error: 'הדבק את ההערות מהפגישה (לפחות כמה שורות)' }, { status: 400 });
  if (!anthropicConfigured()) return NextResponse.json({ error: 'מודל ה-AI לא מחובר' }, { status: 400 });
  const sb = await supabaseServer();
  const { data: mt, error } = await sb.rpc('office_get', { p_entity: 'meetings', p_id: id });
  if (error || !mt) return NextResponse.json({ error: 'הפגישה לא נמצאה' }, { status: 404 });
  const m: any = mt; let client: any = null;
  if (m.client_id) client = (await sb.rpc('office_get', { p_entity: 'clients', p_id: m.client_id })).data;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const system = `אתה מנהל/ת הלקוחות של משרד הפרסום Pixel Digital. מסכם/ת פגישות בעברית תקנית, קצר ומדויק, בלי להמציא עובדות שלא מופיעות בהערות.
החזר JSON בלבד: {"summary":"3–5 משפטים","decisions":["..."],"action_items":[{"title":"פעולה קצרה","owner":"us|client","due":"YYYY-MM-DD או ריק"}],"client_message":"הודעת וואטסאפ קצרה וחמה ללקוח: תודה, סיכום ב-3 נקודות, הצעדים הבאים ומה נדרש ממנו. פתח ב'היי {name},' ובלי חתימה"}
תאריכים יחסיים ("שבוע הבא") המר לתאריך לפי היום ${today}. אם אין משימה ללקוח — אל תמציא.`;
  const user = `פגישה: ${m.title}\nמועד: ${m.starts_at}\nלקוח: ${client?.name ?? 'ליד / ללא לקוח'}${client?.industry ? ` (${client.industry})` : ''}\n\nהערות מהפגישה:\n${notes}`;
  try {
    const r = await claude({ model: MODEL, system, user, maxTokens: 2500 });
    await sb.rpc('office_log_usage', { p_client: m.client_id ?? null, p_agent: 'account_manager', p_model: r.model, p_in: r.usage.input, p_out: r.usage.output, p_cost: tokenCost(r.model, r.usage.input, r.usage.output), p_note: 'סיכום פגישה' });
    const data: any = extractJson(r.text);
    if (!data?.summary) throw new Error('הסיכום לא התקבל — נסה שוב');
    if (b.preview) return NextResponse.json({ data });
    const saved = await sb.rpc('office_meeting_summary_save', { p_meeting: id, p: data, p_notes: notes });
    if (saved.error) throw new Error(saved.error.message);
    return NextResponse.json({ data, ...(saved.data as any) });
  } catch (e: any) { return NextResponse.json({ error: heError(e?.message ?? e) }, { status: 502 }); }
}
