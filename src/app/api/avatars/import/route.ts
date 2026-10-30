import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAnon } from '@/lib/supabase/anon';
// Avatar import from a browser session that produced the images (e.g. ChatGPT tab). Requires a 30-minute,
// owner-issued, single-purpose token. Only public avatar images; no other data can be written this way.
const CORS = { 'access-control-allow-origin': 'https://chatgpt.com', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
export async function OPTIONS() { return new Response(null, { headers: CORS }); }
export async function POST(req: NextRequest) {
  const { token, agent_id, mime, b64, meta } = await req.json();
  const { data, error } = await supabaseAnon().rpc('office_avatar_import', { p_token: token, p_agent: agent_id, p_mime: mime, p_b64: b64, p_meta: meta ?? {} });
  return NextResponse.json(error ? { error: error.message } : { data }, { status: error ? 400 : 200, headers: CORS });
}
