import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { heError } from '@/lib/errors';
import { seedPayload } from '@/agents/roster';
const ALLOW = new Set(['office_approve_and_send', 'office_quota', 'office_artifact', 'office_seed_test_data', 'office_create_import_token', 'office_events_since', 'office_agent_board', 'office_dashboard', 'office_list', 'office_get']);
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { fn, args } = await req.json();
  const sb = await supabaseServer();
  if (fn === 'office_seed_agents') {   // roster comes from the repo, not from the browser
    const { data, error } = await sb.rpc('office_seed_agents', { p_agents: seedPayload() });
    return error ? NextResponse.json({ error: heError(error.message) }, { status: 400 }) : NextResponse.json({ data });
  }
  if (!ALLOW.has(fn)) return NextResponse.json({ error: 'not_allowed' }, { status: 403 });
  const { data, error } = await sb.rpc(fn, args ?? {});
  if (error) return NextResponse.json({ error: heError(error.message), raw: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
