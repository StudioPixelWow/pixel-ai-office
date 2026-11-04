import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { anthropicConfigured } from '@/engine/adapters/anthropic';
import { runCritique } from '@/engine/proposal-critic';
import { heError } from '@/lib/errors';
export const maxDuration = 120;
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await params; if (!anthropicConfigured()) return NextResponse.json({ error: 'מודל ה-AI לא מחובר' }, { status: 400 });
  const sb = await supabaseServer();
  try { return NextResponse.json({ ok: true, critique: await runCritique(sb, id) }); }
  catch (e: any) { return NextResponse.json({ error: heError(e?.message ?? e) }, { status: 502 }); }
}
