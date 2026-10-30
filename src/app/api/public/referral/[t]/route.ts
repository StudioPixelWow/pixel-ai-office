import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAnon } from '@/lib/supabase/anon';
export async function POST(req: NextRequest, { params }: { params: Promise<{ t: string }> }) {
  const { t } = await params; const b = await req.json().catch(() => ({}));
  if (b.website) return NextResponse.json({ ok: true }); // honeypot
  const s = (k: string, n = 200) => String(b[k] ?? '').slice(0, n);
  const { error } = await supabaseAnon().rpc('office_public_referral', { p_token: t, p_name: s('name', 80), p_phone: s('phone', 30), p_email: s('email', 120), p_business: s('business', 120), p_note: s('note', 600) });
  if (error) return NextResponse.json({ error: /missing:contact/.test(error.message) ? 'נא למלא שם וטלפון' : 'הקישור אינו בתוקף' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
