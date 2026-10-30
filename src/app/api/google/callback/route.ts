import { NextResponse, type NextRequest } from 'next/server';
import { me } from '@/lib/api';
import { verifyPay } from '@/lib/paytoken';
import { exchangeCode, gcalSync } from '@/engine/adapters/gcal';
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const u = req.nextUrl; const state = u.searchParams.get('state') ?? ''; const code = u.searchParams.get('code');
  const back = (g: string) => NextResponse.redirect(new URL(`/calendar?g=${g}`, req.url));
  if (u.searchParams.get('error')) return back('denied');
  const v = verifyPay(state); const m = await me().catch(() => null);
  if (!v || v.k !== 'gst' || req.cookies.get('g_state')?.value !== state || !m || !v.id.startsWith(`${m.user_id}.`) || Date.now() - Number(v.id.split('.')[2]) > 600_000 || !code) return back('bad_state');
  try { await exchangeCode(u.origin, code); await gcalSync().catch(() => null); const r = back('connected'); r.cookies.delete('g_state'); return r; }
  catch { return back('failed'); }
}
