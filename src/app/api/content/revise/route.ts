import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { claude } from '@/engine/adapters/anthropic';
import { extractJson } from '@/engine/schemas';
import { tokenCost } from '@/engine/pricing';
import { w } from '@/engine/db';
export const maxDuration = 300;
// Review round: each post with a comment is rewritten by the copywriter agent to follow the comment exactly, then goes back to "pending approval".
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const sb = await supabaseServer(); const { data: m } = await sb.rpc('office_me');
  if (!m || !['owner', 'admin', 'account_manager'].includes((m as any).role)) return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  const b = await req.json().catch(() => ({})); const list: { id: string; note: string }[] = (b.items ?? []).filter((x: any) => x?.id && String(x.note ?? '').trim()).slice(0, 40);
  if (!list.length) return NextResponse.json({ error: 'אין הערות לתיקון' }, { status: 400 });
  const clients = new Map<string, any>();
  const one = async (x: { id: string; note: string }) => {
    const { data: it } = await sb.rpc('office_get', { p_entity: 'content_items', p_id: x.id }); const i: any = it; if (!i) return { id: x.id, ok: false, error: 'לא נמצא' };
    if (!clients.has(i.client_id)) clients.set(i.client_id, (await sb.rpc('office_get', { p_entity: 'clients', p_id: i.client_id })).data);
    const c: any = clients.get(i.client_id) ?? {}; const d = c.profile?.dossier ?? {};
    const system = `את/ה קופירייטר/ית סושיאל בכיר/ה במשרד Pixel Digital. תקן/י פוסט אחד לפי ההערה של מנהל המשרד — בדיוק לפי ההערה, בלי לשנות מה שלא התבקש.
שמור/י על שפת המותג. עברית טבעית. החזר/י JSON בלבד: {"topic":"","idea":"","hook":"","post_text":"","cta":"","hashtags":["#.."],"creative_prompt":"","format":""}`;
    const user = `הלקוח: ${c.name ?? ''}${d.brand?.voice ? `\nטון המותג: ${JSON.stringify(d.brand.voice).slice(0, 500)}` : ''}${d.social_voice ? `\nקול ברשתות: ${JSON.stringify(d.social_voice).slice(0, 500)}` : ''}
הפוסט הנוכחי (${i.format ?? 'פוסט'}, ${new Date(i.due_at).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })}):
${JSON.stringify({ topic: i.topic, idea: i.idea, hook: i.hook, post_text: i.post_text, cta: i.cta, hashtags: i.hashtags, creative_prompt: i.creative_prompt, format: i.format })}

ההערה לתיקון: ${x.note}`;
    try {
      const r = await claude({ model: process.env.REVISE_MODEL || 'claude-sonnet-5-5', system, user, maxTokens: 1800 });
      await w('office_worker_log_usage', { p_client: i.client_id, p_agent: 'copywriter', p_model: r.model, p_in: r.usage.input, p_out: r.usage.output, p_cost: tokenCost(r.model, r.usage.input, r.usage.output), p_note: 'תיקון פוסט לפי הערה' }).catch(() => null);
      const o: any = extractJson(r.text);
      const { error } = await sb.rpc('office_action', { p_action: 'update_content_item', p_payload: { id: x.id, topic: o.topic, idea: o.idea, hook: o.hook, post_text: o.post_text, cta: o.cta, creative_prompt: o.creative_prompt, format: o.format,
        hashtags: Array.isArray(o.hashtags) ? o.hashtags.map((h: string) => (String(h).startsWith('#') ? h : `#${h}`)) : undefined } });
      if (error) throw new Error(error.message);
      await sb.rpc('office_action', { p_action: 'content_set_status', p_payload: { ids: [x.id], status: 'pending_approval' } });
      await sb.rpc('office_content_review_log', { p_id: x.id, p_note: x.note, p_result: 'revised' });
      return { id: x.id, ok: true };
    } catch (e: any) { return { id: x.id, ok: false, error: String(e?.message ?? e).slice(0, 140) }; }
  };
  const out: any[] = []; for (let k = 0; k < list.length; k += 4) out.push(...await Promise.all(list.slice(k, k + 4).map(one)));
  return NextResponse.json({ results: out, ok: out.filter((x) => x.ok).length, failed: out.filter((x) => !x.ok).length });
}
