import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { selfChecks } from '@/engine/tick';
export const maxDuration = 60;
// Owner/admin: run the real connection checks now (same checks the worker runs every 10 minutes).
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const sb = await supabaseServer(); const { data: m } = await sb.rpc('office_me');
  if (!m || !['owner', 'admin'].includes((m as any).role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try { await selfChecks(); return NextResponse.json({ ok: true }); } catch (e: any) { return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 }); }
}
