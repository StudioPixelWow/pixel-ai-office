import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { heError } from '@/lib/errors';
// Upload a contract / document to the client's library (PDF or image, or an https link).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await params; const b = await req.json().catch(() => ({} as any));
  const b64 = b.b64 ? String(b.b64) : null;
  if (b64 && b64.length > 4_200_000) return NextResponse.json({ error: 'קובץ גדול מדי (עד ~3MB)' }, { status: 400 });
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('office_doc_upload', { p_client: id, p_title: String(b.title ?? ''), p_kind: String(b.kind ?? 'other'), p_mime: b.mime ? String(b.mime) : null, p_b64: b64, p_sign: !!b.sign, p_url: b.url ? String(b.url) : null });
  return error ? NextResponse.json({ error: heError(error.message) }, { status: 400 }) : NextResponse.json(data);
}
