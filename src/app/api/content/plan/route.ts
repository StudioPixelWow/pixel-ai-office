import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { syncIsraelCalendar } from '@/lib/israel-calendar';
import { heError } from '@/lib/errors';
export const maxDuration = 60;
// Build a month: refresh the Israeli calendar for that year, then hand the month to the planner agent (permissions checked in the DB action).
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const month = String(b.month ?? '').match(/^\d{4}-\d{2}$/)?.[0]; if (!month || !b.client_id) return NextResponse.json({ error: 'חסר לקוח או חודש' }, { status: 400 });
  let synced: number | null = null; try { synced = await syncIsraelCalendar(Number(month.slice(0, 4))); } catch { /* plan still runs with markers already stored */ }
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('office_action', { p_action: 'start_content_month', p_payload: { client_id: b.client_id, month, posts_per_week: b.posts_per_week ?? 3, days: b.days, platforms: b.platforms, notes: b.notes } });
  if (error) return NextResponse.json({ error: heError(error.message) }, { status: 400 });
  return NextResponse.json({ ...(data as any), calendar_synced: synced });
}
