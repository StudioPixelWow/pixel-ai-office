import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { me } from '@/lib/api';
import { signPay } from '@/lib/paytoken';
import { authUrl, gcalConfigured } from '@/engine/adapters/gcal';
import { marketingAuthUrl } from '@/engine/adapters/gmarketing';
export async function GET(req: NextRequest) {
  const m = await me(); if (!['owner', 'admin'].includes(m.role)) return NextResponse.redirect(new URL('/calendar?g=forbidden', req.url));
  if (!gcalConfigured()) return NextResponse.redirect(new URL('/calendar?g=not_configured', req.url));
  const mk = req.nextUrl.searchParams.get('for') === 'marketing';
  const state = signPay({ k: 'gst', id: `${m.user_id}.${randomBytes(8).toString('hex')}.${Date.now()}${mk ? '.m' : ''}` });
  const res = NextResponse.redirect(mk ? marketingAuthUrl(req.nextUrl.origin, state) : authUrl(req.nextUrl.origin, state));
  res.cookies.set('g_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/api/google' });
  return res;
}
