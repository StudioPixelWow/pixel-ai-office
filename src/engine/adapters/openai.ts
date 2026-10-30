// OpenAI Images API — an explicit, separately-billed connection. ChatGPT (browser) is a different path and is not assumed to include API access.
const BASE = 'https://api.openai.com/v1';
export const openaiConfigured = () => !!process.env.OPENAI_API_KEY;
export const imageModel = () => process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const H = () => ({ authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' });
export async function checkImageModel() {
  const r = await fetch(`${BASE}/models/${imageModel()}`, { headers: H() });
  return { ok: r.ok, status: r.status };
}
export async function generateImage(prompt: string, size: '1024x1024' | '1024x1536' | '1536x1024' = '1024x1024', format?: 'webp' | 'jpeg') {
  const r = await fetch(`${BASE}/images/generations`, { method: 'POST', headers: H(), body: JSON.stringify({ model: imageModel(), prompt, size, n: 1, ...(format ? { output_format: format, output_compression: 82 } : {}) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e: any = new Error(`openai images ${r.status}: ${j?.error?.message ?? ''}`); e.status = r.status; e.retryable = r.status === 429 || r.status >= 500;
    e.noBalance = /billing|quota|insufficient/i.test(j?.error?.message ?? ''); throw e; }
  return { b64: j.data?.[0]?.b64_json as string, usage: j.usage };
}
