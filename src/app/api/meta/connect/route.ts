import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { me } from '@/lib/api';
import { signPay } from '@/lib/paytoken';
import { metaAuthUrl, metaAppConfigured } from '@/engine/adapters/meta';
// "חיבור מטא": the office user (Maya) logs in to Facebook once; read-only ads permissions.
export async function GET(req: NextRequest) {
  const m = await me(); if (!['owner', 'admin'].includes(m.role)) return NextResponse.redirect(new URL('/connections?mt=forbidden', req.url));
  if (!metaAppConfigured()) return NextResponse.redirect(new URL('/connections?mt=not_configured', req.url));
  const state = signPay({ k: 'mst', id: `${m.user_id}.${randomBytes(8).toString('hex')}.${Date.now()}` });
  const res = NextResponse.redirect(metaAuthUrl(req.nextUrl.origin, state));
  res.cookies.set('m_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/api/meta' });
  return res;
}
