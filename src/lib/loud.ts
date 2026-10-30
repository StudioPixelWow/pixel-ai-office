import 'server-only';
import { signPay } from '@/lib/paytoken';
// LOUD Podcast Studio helpers shared by the office and the guest pages.
export const LOUD = { onDark: '/brand/loud-on-dark.svg', onLight: '/brand/loud-on-light.svg', icon: '/brand/loud-icon.svg', mic: '/brand/loud-studio-mic.webp', door: '/brand/loud-studio-door.webp' };
export const guestUrl = (origin: string, id: string) => `${origin.replace(/\/$/, '')}/podcast/${signPay({ k: 'pod', id })}`;
export const intakeUrl = (origin: string) => `${origin.replace(/\/$/, '')}/podcast`;
export const toE164 = (p?: string | null) => { const d = String(p ?? '').replace(/[^\d+]/g, ''); if (/^\+\d{9,15}$/.test(d)) return d; const l = d.replace(/^972/, '0'); return /^0\d{8,9}$/.test(l) ? `+972${l.slice(1)}` : null; };
export function parseSocials(text: string) {
  const out: Record<string, string> = {}; const urls = String(text ?? '').match(/(https?:\/\/)?[\w.-]+\.(com|co\.il|me|net)\/[^\s,]+/gi) ?? [];
  for (const raw of urls) { const u = raw.startsWith('http') ? raw : `https://${raw}`; const h = u.toLowerCase();
    const k = /facebook|fb\.me/.test(h) ? 'facebook' : /instagram/.test(h) ? 'instagram' : /tiktok/.test(h) ? 'tiktok' : /linkedin/.test(h) ? 'linkedin' : /youtube|youtu\.be/.test(h) ? 'youtube' : null;
    if (k && !out[k]) out[k] = u; }
  return out;
}
export const STATUS: Record<string, { he: string; tone: string; step: number }> = {
  intake: { he: 'הסוכנים חוקרים ומכינים שאלות', tone: 'cyan', step: 1 }, questions_review: { he: 'ממתין לאישור שלך', tone: 'yellow', step: 2 },
  client_review: { he: 'אצל האורח לעיון', tone: 'cyan', step: 3 }, changes_requested: { he: 'האורח ביקש שינויים', tone: 'warn', step: 3 },
  awaiting_payment: { he: 'אושר · ממתין לתשלום', tone: 'warn', step: 4 }, paid: { he: 'שולם · ממתין למועד', tone: 'ok', step: 5 },
  scheduled: { he: 'נקבעה הקלטה', tone: 'ok', step: 5 }, recorded: { he: 'הוקלט · בעריכה', tone: 'cyan', step: 6 }, delivered: { he: 'החומרים נמסרו', tone: 'ok', step: 7 }, cancelled: { he: 'בוטל', tone: 'muted', step: 0 },
};
