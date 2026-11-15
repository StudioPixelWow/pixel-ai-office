import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
export async function GET(req: NextRequest) {
  const url = new URL(req.url); const code = url.searchParams.get('code');
  if (code) { const sb = await supabaseServer(); await sb.auth.exchangeCodeForSession(code); await sb.rpc('office_bootstrap'); }
  // Only same-site relative paths (e.g. a password-reset link lands on /settings#password).
  const next = url.searchParams.get('next'); const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return NextResponse.redirect(new URL(safe, url.origin));
}
