import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { claude, anthropicConfigured } from '@/engine/adapters/anthropic';
import { openaiConfigured } from '@/engine/adapters/openai';
import { extractJson } from '@/engine/schemas';
import { tokenCost } from '@/engine/pricing';
import { heError } from '@/lib/errors';
export const maxDuration = 180;
const MODEL = process.env.SUMMARY_MODEL ?? 'claude-sonnet-5-5';
const TTS = process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts';
// "דוח מדבר": the written monthly report → a 60–90s narrated slide story (script by Claude, voice by OpenAI TTS). Stored with the report; the client sees it only once the report is shared.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await params; const b = await req.json().catch(() => ({} as any)); const month = /^\d{4}-\d{2}/.test(String(b.month ?? '')) ? `${String(b.month).slice(0, 7)}-01` : null;
  if (!month) return NextResponse.json({ error: 'חודש לא תקין' }, { status: 400 });
  if (!anthropicConfigured() || !openaiConfigured()) return NextResponse.json({ error: 'חסר חיבור ל-Claude או ל-OpenAI' }, { status: 400 });
  const sb = await supabaseServer();
  const [{ data: reps }, { data: client }] = await Promise.all([sb.rpc('office_client_reports', { p_client: id }), sb.rpc('office_get', { p_entity: 'clients', p_id: id })]);
  const rep = ((reps as any)?.reports ?? []).find((x: any) => String(x.month).slice(0, 7) === month.slice(0, 7));
  if (!rep?.summary?.headline) return NextResponse.json({ error: 'קודם צריך דוח כתוב לחודש הזה' }, { status: 400 });
  const name = (client as any)?.name ?? '';
  const system = `את/ה מנהל/ת הלקוח בפיקסל דיגיטל ומקליט/ה ללקוח "דוח חודשי מדבר" של 60–90 שניות, בעברית מדוברת, חמה ועניינית.
השתמש/י רק בעובדות ובמספרים מהדוח. חלק/י ל-5–7 שקפים. בכל שקף: כותרת קצרה (עד 5 מילים), מספר/מילה גדולה אחת אם יש (אחרת ריק), שורה קצרה, ומה שאומרים בקול (1–3 משפטים, בלי מספרים שלא בדוח).
שקף ראשון: פתיחה אישית ("היי, כאן פיקסל דיגיטל עם הסיכום של <חודש>"). אחרון: מה בחודש הבא + סיום חם.
החזר JSON בלבד: {"slides":[{"title":"...","big":"...","line":"...","say":"..."}]}`;
  try {
    const r = await claude({ model: MODEL, system, user: `לקוח: ${name}\nחודש: ${month.slice(0, 7)}\nהדוח:\n${JSON.stringify(rep.summary)}`, maxTokens: 1800 });
    await sb.rpc('office_log_usage', { p_client: id, p_agent: 'performance_analyst', p_model: r.model, p_in: r.usage.input, p_out: r.usage.output, p_cost: tokenCost(r.model, r.usage.input, r.usage.output), p_note: 'תסריט דוח מדבר' });
    const d: any = extractJson(r.text); const slides: any[] = (d?.slides ?? []).filter((s: any) => s?.say).slice(0, 8);
    if (slides.length < 3) throw new Error('התסריט לא התקבל — נסה שוב');
    const script = slides.map((s) => s.say).join(' ');
    const a = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: TTS, voice: process.env.OPENAI_TTS_VOICE ?? 'coral', input: script, response_format: 'mp3',
        instructions: 'דבר/י בעברית ישראלית טבעית, בקצב נעים, חם ובטוח, כמו מנהלת לקוח שמספרת בגאווה על הישגי החודש.' }), signal: AbortSignal.timeout(120000) });
    if (!a.ok) throw new Error(`הקול לא נוצר (OpenAI ${a.status})`);
    const buf = Buffer.from(await a.arrayBuffer());
    await sb.rpc('office_log_usage', { p_client: id, p_agent: 'performance_analyst', p_model: TTS, p_in: script.length, p_out: 0, p_cost: Math.round((script.length / 1000) * 0.015 * 10000) / 10000, p_note: 'קריינות דוח מדבר' });
    const total = slides.reduce((n, s) => n + s.say.length, 0); let acc = 0;
    const timed = slides.map((s) => { const at = acc / total; acc += s.say.length; return { title: s.title, big: s.big ?? '', line: s.line ?? '', at: Math.round(at * 1000) / 1000 }; });
    const sv = await sb.rpc('office_report_voice_save', { p_client: id, p_month: month, p_slides: timed, p_script: script, p_mime: 'audio/mpeg', p_b64: buf.toString('base64') });
    if (sv.error) throw new Error(sv.error.message);
    return NextResponse.json({ ok: true, slides: timed, audio_blob: (sv.data as any).audio_blob });
  } catch (e: any) { return NextResponse.json({ error: heError(e?.message ?? e) }, { status: 502 }); }
}
