import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { generateImage, openaiConfigured } from '@/engine/adapters/openai';
import { heError } from '@/lib/errors';
export const maxDuration = 120;
// Creative for one Gantt slot: generate from the slot's prompt in the client's palette, or upload the team's own image.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await params; const b = await req.json().catch(() => ({}));
  const sb = await supabaseServer();
  const { data: item, error: e1 } = await sb.rpc('office_get', { p_entity: 'content_items', p_id: id });
  if (e1 || !item) return NextResponse.json({ error: 'הפריט לא נמצא' }, { status: 404 });
  if (b.mode === 'upload') {
    const mime = String(b.mime ?? ''); const b64 = String(b.b64 ?? '');
    if (!/^image\/(png|jpeg|webp)$/.test(mime)) return NextResponse.json({ error: 'PNG, JPG או WEBP בלבד' }, { status: 400 });
    if (b64.length > 4_000_000) return NextResponse.json({ error: 'קובץ גדול מדי (עד ~3MB)' }, { status: 400 });
    const { data, error } = await sb.rpc('office_content_set_creative', { p_item: id, p_mime: mime, p_b64: b64, p_prompt: null });
    return error ? NextResponse.json({ error: heError(error.message) }, { status: 400 }) : NextResponse.json(data);
  }
  if (!openaiConfigured()) return NextResponse.json({ error: 'יצירת תמונות לא מחוברת (OpenAI)' }, { status: 400 });
  const { data: client } = await sb.rpc('office_get', { p_entity: 'clients', p_id: (item as any).client_id });
  const colors = ((client as any)?.profile?.dossier?.brand?.colors ?? (client as any)?.profile?.brand_colors ?? []).slice(0, 4).map((c: any) => c.hex).filter(Boolean).join(', ');
  const visual = (client as any)?.profile?.dossier?.social_voice?.visual_style ?? '';
  const prompt = `${String(b.prompt || (item as any).creative_prompt || (item as any).idea || (item as any).topic)}. Social media ${String((item as any).format ?? 'post')} visual for ${(client as any)?.name ?? 'a brand'}.${visual ? ` Visual style: ${visual}.` : ''}${colors ? ` Brand palette: ${colors}.` : ''} No text, no letters, no logos, no watermark. Clean, premium, scroll-stopping.`;
  const size = /סטורי|story|רילס|reel/i.test(String((item as any).format ?? '')) ? '1024x1536' : '1024x1024';
  try {
    const img = await generateImage(prompt, size, 'webp');
    const { data, error } = await sb.rpc('office_content_set_creative', { p_item: id, p_mime: 'image/webp', p_b64: img.b64, p_prompt: b.prompt ? String(b.prompt) : null });
    return error ? NextResponse.json({ error: heError(error.message) }, { status: 400 }) : NextResponse.json(data);
  } catch (e: any) { return NextResponse.json({ error: e?.noBalance ? 'אין יתרה בחשבון OpenAI' : String(e.message ?? e).slice(0, 200) }, { status: 502 }); }
}
