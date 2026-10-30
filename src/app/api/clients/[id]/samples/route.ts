import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { enrichSample } from '@/engine/research';
import { heError } from '@/lib/errors';
export const maxDuration = 60;
// Team pastes post/reel/video links (one per line, optional view count after a space) → enriched samples in the asset bank.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await params; const { text } = await req.json().catch(() => ({ text: '' }));
  const lines = String(text ?? '').split(/\n|,(?=\s*https?:)/).map((l) => l.trim()).filter(Boolean);
  const rows = lines.map((l) => { const url = l.match(/https?:\/\/\S+/)?.[0]?.replace(/[)\]>.,]+$/, ''); const views = Number(l.replace(url ?? '', '').match(/\d[\d,]*/)?.[0]?.replace(/,/g, '')) || null; return url ? { url: url.split('?')[0], views } : null; })
    .filter(Boolean).slice(0, 30) as { url: string; views: number | null }[];
  if (!rows.length) return NextResponse.json({ error: 'לא נמצאו קישורים' }, { status: 400 });
  const samples = await Promise.all(rows.map((r) => enrichSample(r.url, { views: r.views })));
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('office_add_samples', { p_client: id, p_samples: samples });
  if (error) return NextResponse.json({ error: heError(error.message) }, { status: 400 });
  return NextResponse.json({ ...(data as any), enriched: samples.filter((s) => s.enriched).length });
}
