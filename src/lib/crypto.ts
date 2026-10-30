import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
// AES-256-GCM for OAuth tokens at rest. The key never leaves the server environment.
const key = () => { const s = process.env.CRON_SECRET; if (!s) throw new Error('CRON_SECRET missing'); return createHash('sha256').update(`${s}:oauth-tokens:v1`).digest(); };
export function seal(plain: string) { const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', key(), iv); const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.'); }
export function unseal(box: string) { const [iv, tag, enc] = box.split('.').map((x) => Buffer.from(x, 'base64url')); const d = createDecipheriv('aes-256-gcm', key(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8'); }
