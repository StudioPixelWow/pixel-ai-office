// Claude Messages API. Model IDs are verified against GET /v1/models at check time — never silently substituted.
const BASE = 'https://api.anthropic.com/v1';
const H = () => ({ 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' });
export const anthropicConfigured = () => !!process.env.ANTHROPIC_API_KEY;
export async function listModels(): Promise<string[]> {
  const r = await fetch(`${BASE}/models?limit=100`, { headers: H() });
  if (!r.ok) throw Object.assign(new Error(`anthropic models ${r.status}`), { status: r.status });
  const j = await r.json(); return (j.data ?? []).map((m: any) => m.id);
}
export async function claude(opts: { model: string; system: string; user: string; maxTokens?: number; signal?: AbortSignal }) {
  const r = await fetch(`${BASE}/messages`, { method: 'POST', headers: H(), signal: opts.signal,
    body: JSON.stringify({ model: opts.model, max_tokens: opts.maxTokens ?? 4000, system: opts.system, messages: [{ role: 'user', content: opts.user }] }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e: any = new Error(`claude ${r.status}: ${j?.error?.message ?? ''}`); e.status = r.status; e.retryable = r.status === 429 || r.status >= 500; throw e; }
  const text = (j.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
  return { text, model: j.model as string, usage: { input: j.usage?.input_tokens ?? 0, output: j.usage?.output_tokens ?? 0 } };
}
