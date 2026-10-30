import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { supabaseAnon } from '@/lib/supabase/anon';
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const b = await req.json().catch(() => ({}));
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  const { data, error } = await supabaseAnon().rpc('office_public_sign', { p_token: token, p_name: String(b.name ?? ''), p_title: String(b.title ?? ''),
    p_sig_b64: String(b.signature ?? ''), p_ua: req.headers.get('user-agent') ?? '', p_ip: createHash('sha256').update(ip).digest('hex') });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
