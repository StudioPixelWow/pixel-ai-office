import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
// Signed, non-guessable public references. k = 'pmt' (billing payment id) | 'prp' (proposal public token) | 'pod' (LOUD studio booking).
type P = { k: 'pmt' | 'prp' | 'pod' | 'cal' | 'gst'; id: string };
const key = () => { const s = process.env.CRON_SECRET; if (!s) throw new Error('CRON_SECRET missing'); return `${s}:pay-page:v1`; };
const b64 = (s: string) => Buffer.from(s).toString('base64url');
export function signPay(p: P) { const body = b64(JSON.stringify(p)); const sig = createHmac('sha256', key()).update(body).digest('base64url').slice(0, 32); return `${body}.${sig}`; }
export function verifyPay(t: string): P | null {
  const [body, sig] = String(t ?? '').split('.'); if (!body || !sig) return null;
  const want = createHmac('sha256', key()).update(body).digest('base64url').slice(0, 32);
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p?.k && p?.id ? p : null; } catch { return null; }
}
export const payUrl = (origin: string, p: P) => `${origin.replace(/\/$/, '')}/pay/g/${signPay(p)}`;
