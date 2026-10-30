import { type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
// SSE: replays everything after Last-Event-ID (or ?after=), so a reconnecting client never misses engine events.
export async function GET(req: NextRequest) {
  const sb = await supabaseServer();
  let after = Number(req.headers.get('last-event-id') ?? req.nextUrl.searchParams.get('after') ?? 0);
  if (!after) { const d = await sb.rpc('office_dashboard'); after = Number((d.data as any)?.last_event_id ?? 0); }
  const enc = new TextEncoder(); const started = Date.now();
  const stream = new ReadableStream({
    async start(ctrl) {
      ctrl.enqueue(enc.encode('retry: 3000\n\n'));
      while (Date.now() - started < 50_000) {
        if (req.signal.aborted) break;
        const { data, error } = await sb.rpc('office_events_since', { p_after: after, p_limit: 200 });
        if (error) { ctrl.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify(error.message)}\n\n`)); break; }
        for (const e of (data as any[]) ?? []) { after = e.id; ctrl.enqueue(enc.encode(`id: ${e.id}\ndata: ${JSON.stringify(e)}\n\n`)); }
        ctrl.enqueue(enc.encode(': ping\n\n'));
        await new Promise((r) => setTimeout(r, 2500));
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' } });
}
