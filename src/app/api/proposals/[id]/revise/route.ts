import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { claude, anthropicConfigured } from '@/engine/adapters/anthropic';
import { extractJson } from '@/engine/schemas';
import { tokenCost } from '@/engine/pricing';
import { runCritique } from '@/engine/proposal-critic';
import { heError } from '@/lib/errors';
export const maxDuration = 300;
// Tal picks which reviewer notes to use → the proposal texts are rewritten into a new version (price and client details untouched) → the reviewer scores it again.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await params; if (!anthropicConfigured()) return NextResponse.json({ error: 'מודל ה-AI לא מחובר' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const sb = await supabaseServer();
  const { data: ctx, error } = await sb.rpc('office_proposal_revise_ctx', { p_proposal: id });
  if (error || !ctx) return NextResponse.json({ error: heError(error?.message ?? 'not_found') }, { status: 400 });
  const cr = ctx.critique ?? {};
  const norm = (f: any) => typeof f === 'string' ? { section: '', issue: f, rewrite: '' } : { section: f.section ?? f.field ?? '', issue: f.issue ?? f.problem ?? f.note ?? '', rewrite: f.rewrite ?? f.suggestion ?? '' };
  const fixes = (Array.isArray(b.fixes) ? b.fixes : []).map((i: number) => cr.fixes?.[i]).filter(Boolean).map(norm);
  const risks = (Array.isArray(b.risks) ? b.risks : []).map((i: number) => cr.risks?.[i]).filter(Boolean);
  const extra = String(b.extra ?? '').trim().slice(0, 2000);
  if (!fixes.length && !risks.length && !extra) return NextResponse.json({ error: 'בחר לפחות הערה אחת לתיקון' }, { status: 400 });
  const notes = [...fixes.map((f: any, i: number) => `${i + 1}. [${f.section}] ${f.issue}\n   ניסוח מוצע: ${f.rewrite}`), ...risks.map((r: string) => `• סיכון לטפל בו: ${r}`), ...(extra ? [`• הערה של טל: ${extra}`] : [])].join('\n');
  try {
    const r = await claude({ model: 'claude-opus-5-5', maxTokens: 8000,
      system: `אתה עורך הצעות המחיר של פיקסל דיגיטל. אתה מקבל את תוכן ההצעה (JSON) ורשימת הערות שטל בחר ליישם. יישם רק את ההערות שנבחרו — את כולן, ובלי לשנות דברים אחרים. כתיבה בעברית, ממוקדת בליד ובצורך שלו, בלי הבטחות שאי אפשר לעמוד בהן.
אסור לשנות: מחיר, סכומים, תנאי תשלום, מע״מ, פרטי הלקוח (client), kind, vat_mode, validity_days. אל תוסיף מחירים לטקסט.
שמור על אותו מבנה JSON בדיוק לכל שדה שאתה משנה (למשל highlights הוא מערך של {t,s}, blocks הוא מערך של {key,tag,title,bullets}, steps מערך של {t,s}). כשאתה משנה מערך — החזר את המערך המלא אחרי השינוי. אל תשתמש במירכאות כפולות בתוך טקסט עברי (השתמש בגרשיים ״).
החזר JSON בלבד: {"content":{...רק השדות ששונו...},"summary":"משפט קצר: מה תוקן","applied":["תיאור קצר לכל הערה שיושמה"]}`,
      user: `תוכן ההצעה הנוכחי (גרסה ${ctx.version_no}):\n${JSON.stringify(ctx.content)}\n\nהליד: ${JSON.stringify(ctx.lead ?? {})}\n\nההערות שנבחרו ליישום:\n${notes}` });
    await sb.rpc('office_log_usage', { p_client: null, p_agent: 'proposal_critic', p_model: r.model, p_in: r.usage.input, p_out: r.usage.output, p_cost: tokenCost(r.model, r.usage.input, r.usage.output), p_note: 'תיקון הצעה לפי הערות' });
    const out: any = extractJson(r.text);
    if (!out?.content || typeof out.content !== 'object' || !Object.keys(out.content).length) throw new Error('התיקון לא התקבל — נסה שוב');
    const { data: saved, error: e2 } = await sb.rpc('office_proposal_revise_save', { p_proposal: id, p_content: out.content, p_summary: out.summary ?? '', p_applied: [...fixes.map((f: any) => [f.section, f.issue].filter(Boolean).join(': ')), ...risks, ...(extra ? [extra] : [])] });
    if (e2) throw new Error(e2.message);
    let critique: any = null; try { critique = await runCritique(sb, id); } catch { /* the new version is saved even if the re-score fails */ }
    return NextResponse.json({ ok: true, version: saved?.version_no, summary: out.summary, critique, prev_score: cr.score ?? null });
  } catch (e: any) { return NextResponse.json({ error: heError(e?.message ?? e) }, { status: 502 }); }
}
