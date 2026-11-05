import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
// Owner only: create (or replace) the inbound-leads address. The token is shown once and only its hash is stored.
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const sb = await supabaseServer(); const { data, error } = await sb.rpc('office_lead_hook_rotate');
  if (error || !data) return NextResponse.json({ error: 'רק ה-Owner יכול ליצור כתובת' }, { status: 403 });
  return NextResponse.json({ url: `${req.nextUrl.origin}/api/webhooks/leads/${data}` });
}
