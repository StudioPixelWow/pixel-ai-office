import { NextResponse, type NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { w } from '@/engine/db';
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get('hub.mode') === 'subscribe' && process.env.WHATSAPP_VERIFY_TOKEN && q.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) return new Response(q.get('hub.challenge') ?? '');
  return new Response('forbidden', { status: 403 });
}
// Signature verified; events deduped in DB; inbound replies stop stale follow-ups and never authorise anything.
export async function POST(req: NextRequest) {
  const raw = await req.text(); const sig = req.headers.get('x-hub-signature-256') ?? '';
  const secret = process.env.WHATSAPP_APP_SECRET; if (!secret) return new Response('not configured', { status: 503 });
  const want = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return new Response('bad signature', { status: 401 });
  const body = JSON.parse(raw);
  for (const entry of body.entry ?? []) for (const ch of entry.changes ?? []) {
    const v = ch.value ?? {};
    for (const s of v.statuses ?? []) await w('office_provider_event', { p_provider: 'whatsapp_cloud', p_event_id: `st:${s.id}:${s.status}`, p_payload: { type: 'message_status', provider_message_id: s.id, status: s.status } });
    for (const m of v.messages ?? []) await w('office_provider_event', { p_provider: 'whatsapp_cloud', p_event_id: `in:${m.id}`,
      p_payload: { type: 'inbound_message', from: '+' + m.from, text: m.text?.body ?? `[${m.type}]`, provider_message_id: m.id, timestamp: new Date(Number(m.timestamp) * 1000).toISOString(), profile_name: v.contacts?.[0]?.profile?.name } });
  }
  return NextResponse.json({ ok: true });
}
