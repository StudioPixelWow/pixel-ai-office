import { type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
// Private file access: scope is checked in the DB per request (no public URLs, no thumbnails leaking across clients).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params; const sb = await supabaseServer();
  const first = await sb.rpc('office_get_blob', { p_id: id, p_part: 1 });
  if (first.error) return new Response('not found', { status: 404 });
  const meta = first.data as any; const parts: Buffer[] = [Buffer.from(meta.b64, 'base64')];
  for (let p = 2; p <= (meta.parts ?? 1); p++) { const r = await sb.rpc('office_get_blob', { p_id: id, p_part: p }); if (r.error) return new Response('incomplete', { status: 500 }); parts.push(Buffer.from((r.data as any).b64, 'base64')); }
  const buf = Buffer.concat(parts);
  const dl = req.nextUrl.searchParams.get('download');
  return new Response(buf, { headers: { 'content-type': meta.mime, 'content-length': String(buf.length), 'cache-control': 'private, max-age=300',
    ...(dl ? { 'content-disposition': `attachment; filename="${dl.replace(/[^\w.\-]/g, '_')}"` } : {}) } });
}
