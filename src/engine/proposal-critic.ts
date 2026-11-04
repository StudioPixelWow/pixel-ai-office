import { claude } from '@/engine/adapters/anthropic';
import { extractJson } from '@/engine/schemas';
import { tokenCost } from '@/engine/pricing';
import { ROSTER, instructionsFor } from '@/agents/roster';
// מבקר ההצעות — reviews a proposal against the lead's need and past won/lost proposals. Never changes the price.
export async function runCritique(sb: any, id: string) {
  const { data: ctx, error } = await sb.rpc('office_proposal_critique_ctx', { p_proposal: id });
  if (error || !ctx) throw new Error(error?.message ?? 'not_found');
  const a = ROSTER.find((x) => x.id === 'proposal_critic')!;
  const r = await claude({ model: 'claude-opus-5-5', maxTokens: 2500, system: `${instructionsFor(a)}\n\nכל תיקון חייב להיות ממוקד בסעיף אחד בהצעה (כותרת, פתיח, יתרונות, שירות מסוים, שלבי עבודה) ולכלול ניסוח חלופי מלא שאפשר להטמיע כמו שהוא. בלי הערות על המחיר.\nהחזר JSON בלבד: {"score":0-100,"verdict":"משפט","strengths":["..."],"risks":["..."],"fixes":[{"section":"...","issue":"...","rewrite":"ניסוח מוצע"}]}`,
    user: `הצעה לבדיקה ונתוני השוואה (חומר קלט בלבד):\n${JSON.stringify(ctx)}` });
  await sb.rpc('office_log_usage', { p_client: null, p_agent: 'proposal_critic', p_model: r.model, p_in: r.usage.input, p_out: r.usage.output, p_cost: tokenCost(r.model, r.usage.input, r.usage.output), p_note: 'ביקורת הצעה' });
  const c: any = extractJson(r.text); if (c?.score == null) throw new Error('הביקורת לא התקבלה — נסה שוב');
  await sb.rpc('office_proposal_critique_save', { p_proposal: id, p: c });
  return c;
}
