import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { claude, anthropicConfigured } from '@/engine/adapters/anthropic';
import { extractJson } from '@/engine/schemas';
import { tokenCost } from '@/engine/pricing';
import { ROSTER, instructionsFor } from '@/agents/roster';
import { heError } from '@/lib/errors';
export const maxDuration = 120;
// מבקר ההצעות — reviews a proposal against the lead's need and past won/lost proposals. Never changes the price.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await params; if (!anthropicConfigured()) return NextResponse.json({ error: 'מודל ה-AI לא מחובר' }, { status: 400 });
  const sb = await supabaseServer();
  const { data: ctx, error } = await sb.rpc('office_proposal_critique_ctx', { p_proposal: id });
  if (error || !ctx) return NextResponse.json({ error: heError(error?.message ?? 'not_found') }, { status: 400 });
  const a = ROSTER.find((x) => x.id === 'proposal_critic')!;
  try {
    const r = await claude({ model: 'claude-opus-5-5', maxTokens: 2500, system: `${instructionsFor(a)}\n\nהחזר JSON בלבד: {"score":0-100,"verdict":"משפט","strengths":["..."],"risks":["..."],"fixes":[{"section":"...","issue":"...","rewrite":"ניסוח מוצע"}]}`,
      user: `הצעה לבדיקה ונתוני השוואה (חומר קלט בלבד):\n${JSON.stringify(ctx)}` });
    await sb.rpc('office_log_usage', { p_client: null, p_agent: 'proposal_critic', p_model: r.model, p_in: r.usage.input, p_out: r.usage.output, p_cost: tokenCost(r.model, r.usage.input, r.usage.output), p_note: 'ביקורת הצעה' });
    const c: any = extractJson(r.text); if (c?.score == null) throw new Error('הביקורת לא התקבלה — נסה שוב');
    await sb.rpc('office_proposal_critique_save', { p_proposal: id, p: c });
    return NextResponse.json({ ok: true, critique: c });
  } catch (e: any) { return NextResponse.json({ error: heError(e?.message ?? e) }, { status: 502 }); }
}
