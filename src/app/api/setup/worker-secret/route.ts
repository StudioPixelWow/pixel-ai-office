import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { supabaseServer } from '@/lib/supabase/server';
// Owner-only: hash the server-side WORKER_SECRET (or CRON_SECRET) and register the hash. The secret itself never leaves the server.
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const s = process.env.WORKER_SECRET || process.env.CRON_SECRET;
  if (!s || s.length < 32) return NextResponse.json({ error: 'CRON_SECRET (לפחות 32 תווים) לא הוגדר בשרת' }, { status: 400 });
  const sb = await supabaseServer();
  const { error } = await sb.rpc('office_register_worker_secret', { p_sha256: createHash('sha256').update(s).digest('hex') });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
