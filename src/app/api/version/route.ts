import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
// Which build is live — the open app compares it to the build it was loaded with.
export function GET() { return NextResponse.json({ v: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? 'dev' }, { headers: { 'cache-control': 'no-store' } }); }
