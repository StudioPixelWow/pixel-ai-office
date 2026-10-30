import { type NextRequest } from 'next/server';
import { w } from '@/engine/db';
import { resolvePortal } from '@/lib/portal';
// Creative images for the client's own posts only (checked in the DB).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ t: string; id: string }> }) {
  const { t, id } = await params; const p = await resolvePortal(t); if (!p || !/^[0-9a-f-]{36}$/.test(id)) return new Response('not found', { status: 404 });
  try {
    const first: any = await w('office_worker_portal_blob', { p_client: p.client, p_rev: p.rev, p_blob: id, p_part: 1 });
    const parts = [Buffer.from(first.b64, 'base64')];
    for (let i = 2; i <= (first.parts ?? 1); i++) { const r: any = await w('office_worker_portal_blob', { p_client: p.client, p_rev: p.rev, p_blob: id, p_part: i }); parts.push(Buffer.from(r.b64, 'base64')); }
    const buf = Buffer.concat(parts);
    return new Response(buf, { headers: { 'content-type': first.mime, 'cache-control': 'private, max-age=600' } });
  } catch { return new Response('not found', { status: 404 }); }
}
