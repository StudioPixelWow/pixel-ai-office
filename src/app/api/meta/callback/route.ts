import { NextResponse, type NextRequest } from 'next/server';
import { me } from '@/lib/api';
import { verifyPay } from '@/lib/paytoken';
import { metaExchange } from '@/engine/adapters/meta';
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const u = req.nextUrl; const state = u.searchParams.get('state') ?? ''; const code = u.searchParams.get('code');
  const back = (s: string) => NextResponse.redirect(new URL(`/connections?mt=${s}`, req.url));
  if (u.searchParams.get('error')) return back('denied');
  const v = verifyPay(state); const m = await me().catch(() => null);
  if (!v || v.k !== 'mst' || req.cookies.get('m_state')?.value !== state || !m || !String(v.id).startsWith(`${m.user_id}.`) || Date.now() - Number(String(v.id).split('.')[2]) > 600_000 || !code) return back('bad_state');
  try { await metaExchange(u.origin, code); const r = back('connected'); r.cookies.delete('m_state'); return r; } catch { return back('failed'); }
}
