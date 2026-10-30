import 'server-only';
import { w } from '@/engine/db';
import { verifyPortal } from './paytoken';
// Portal links are short DB tokens (/c/<token>); older HMAC links keep working until rotated.
export async function resolvePortal(t: string): Promise<{ client: string; rev: number } | null> {
  const h = verifyPortal(t); if (h) return h;
  if (!/^[0-9a-f]{30,64}$/.test(String(t ?? ''))) return null;
  const r: any = await w('office_worker_portal_resolve', { p_token: t }).catch(() => null);
  return r?.client ? { client: r.client, rev: Number(r.rev) } : null;
}
