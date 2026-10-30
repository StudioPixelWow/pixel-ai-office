import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { heError } from '@/lib/errors';
// All mutations go through the DB action catalog (permission matrix + state transitions enforced server-side).
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { action, payload } = await req.json();
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('office_action', { p_action: String(action), p_payload: payload ?? {} });
  if (error) return NextResponse.json({ error: heError(error.message), raw: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
