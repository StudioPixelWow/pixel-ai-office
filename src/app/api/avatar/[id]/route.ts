import { type NextRequest } from 'next/server';
import { supabaseAnon } from '@/lib/supabase/anon';
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { data, error } = await supabaseAnon().rpc('office_public_blob', { p_id: id });
  if (error || !data) return new Response('not found', { status: 404 });
  const d = data as any; return new Response(Buffer.from(d.b64, 'base64'), { headers: { 'content-type': d.mime, 'cache-control': 'public, max-age=86400, immutable' } });
}
