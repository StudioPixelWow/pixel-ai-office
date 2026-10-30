import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
// Owner uploads Pixi's avatar (image produced in the ChatGPT series tab).
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any)); const sb = await supabaseServer();
  if (String(b.b64 ?? '').length > 2_000_000) return NextResponse.json({ error: 'too_large' }, { status: 400 });
  const { data, error } = await sb.rpc('office_set_pixi_avatar', { p_mime: String(b.mime ?? ''), p_b64: String(b.b64 ?? '') });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json(data);
}
