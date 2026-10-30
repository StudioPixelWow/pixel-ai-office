import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { tick } from '@/engine/tick';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
// Invoked every minute by Vercel Cron. Work is driven by DB state — closing the dashboard never stops accepted work.
export async function GET(req: NextRequest) {
  const got = Buffer.from(req.headers.get('authorization') ?? ''); const want = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? '-'}`);
  if (!process.env.CRON_SECRET || got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const minute = new Date().getUTCMinutes();
  const report = await tick({ budgetMs: 240_000, checks: minute % 10 === 0 || req.nextUrl.searchParams.has('checks') });
  return NextResponse.json(report);
}
