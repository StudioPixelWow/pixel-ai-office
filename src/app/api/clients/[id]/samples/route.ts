import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { enrichSample, netOf } from '@/engine/research';
import { heError } from '@/lib/errors';
export const maxDuration = 60;
// Team pastes post/reel/video links (one per line, optional view count after a space) → enriched samples in the asset bank.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await params; const { text, items } = await req.json().catch(() => ({ text: '' }));
  // Pre-collected items (e.g. gathered in the team's signed-in browser): keep their captions, enrich only what's missing.
  if (Array.isArray(items) && items.length) {
    const clean = items.slice(0, 40).filter((x: any) => /^https:\/\//.test(String(x?.url ?? ''))).map((x: any) => ({ network: x.network || netOf(x.url), url: String(x.url).slice(0, 500), type: String(x.type ?? 'post').slice(0, 20),
      text: String(x.text ?? '').slice(0, 2500), date: x.date ? String(x.date).slice(0, 40) : null, views: Number(x.views) || null, likes: Number(x.likes) || null, thumb: null, source: 'browser', author: x.author ? String(x.author).slice(0, 80) : null }));
    const sb0 = await supabaseServer(); const { data, error } = await sb0.rpc('office_add_samples', { p_client: id, p_samples: clean });
    if (error) return NextResponse.json({ error: heError(error.message) }, { status: 400 });
    return NextResponse.json({ ...(data as any), enriched: clean.filter((c: any) => c.text).length });
  }
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
