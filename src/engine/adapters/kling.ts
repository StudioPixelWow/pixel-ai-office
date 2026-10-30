import { createHmac } from 'node:crypto';
// Kling API: async task + task id. A local timeout is never a reason to submit again — we poll the saved task id.
const BASE = process.env.KLING_API_BASE || 'https://api-singapore.klingai.com';
export const klingConfigured = () => !!(process.env.KLING_ACCESS_KEY && process.env.KLING_SECRET_KEY);
function jwt() {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url'); const now = Math.floor(Date.now() / 1000);
  const head = b({ alg: 'HS256', typ: 'JWT' }); const body = b({ iss: process.env.KLING_ACCESS_KEY, exp: now + 1800, nbf: now - 5 });
  const sig = createHmac('sha256', process.env.KLING_SECRET_KEY!).update(`${head}.${body}`).digest('base64url'); return `${head}.${body}.${sig}`;
}
const H = () => ({ authorization: `Bearer ${jwt()}`, 'content-type': 'application/json' });
export async function submitText2Video(p: { prompt: string; duration?: '5' | '10'; aspect_ratio?: '9:16' | '16:9' | '1:1'; model_name?: string; callback_url?: string; external_task_id?: string }) {
  const r = await fetch(`${BASE}/v1/videos/text2video`, { method: 'POST', headers: H(), body: JSON.stringify({ model_name: p.model_name ?? process.env.KLING_MODEL ?? 'kling-v2-1', prompt: p.prompt, duration: p.duration ?? '5', aspect_ratio: p.aspect_ratio ?? '9:16', callback_url: p.callback_url, external_task_id: p.external_task_id }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.code !== 0) { const e: any = new Error(`kling submit ${r.status}/${j.code}: ${j.message ?? ''}`); e.retryable = r.status >= 500 || r.status === 429; e.noBalance = /balance|insufficient|credit/i.test(j.message ?? ''); throw e; }
  return j.data.task_id as string;
}
export async function getTask(taskId: string) {
  const r = await fetch(`${BASE}/v1/videos/text2video/${taskId}`, { headers: H() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.code !== 0) throw new Error(`kling status ${r.status}/${j.code}: ${j.message ?? ''}`);
  const d = j.data; return { status: d.task_status as 'submitted' | 'processing' | 'succeed' | 'failed', videos: (d.task_result?.videos ?? []) as { url: string; duration: string }[], msg: d.task_status_msg };
}
export async function checkAuth() {
  const r = await fetch(`${BASE}/v1/videos/text2video?pageNum=1&pageSize=1`, { headers: H() });
  return { ok: r.ok, status: r.status };
}
