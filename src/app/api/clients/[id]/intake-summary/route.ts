import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { summarizeIntake } from '@/engine/intake-summary';
export const maxDuration = 60;
// Office: (re)build the AI prep sheet for the scoping call from the client's intake file.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const { id } = await params; const sb = await supabaseServer();
  const { data, error } = await sb.rpc('office_intake_get', { p_client: id });
  const i: any = (data as any)?.intake; if (error || !i) return NextResponse.json({ error: 'אין תיק אפיון ללקוח' }, { status: 400 });
  try { const s = await summarizeIntake(id, i.client_name, i.services ?? [], i.data ?? {}, i.files ?? []); return s ? NextResponse.json({ summary: s }) : NextResponse.json({ error: 'התיק עוד ריק — אין מה לסכם' }, { status: 400 }); }
  catch { return NextResponse.json({ error: 'יצירת הסיכום נכשלה, נסו שוב' }, { status: 500 }); }
}
