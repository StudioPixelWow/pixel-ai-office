import { safeList, me } from '@/lib/api';
import { syncIsraelCalendar } from '@/lib/israel-calendar';
import { ContentCalendar } from './calendar';
import { logoOf } from '@/lib/logo';
export const dynamic = 'force-dynamic';
// Content Gantt: one retainer client × one month. Posts, holidays/RTM markers and publishing status in one calendar.
export default async function ContentPage({ searchParams }: { searchParams: Promise<{ m?: string; client?: string }> }) {
  const sp = await searchParams; const m = await me();
  const nowIL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? '') ? sp.m! : nowIL; const [y, mo] = month.split('-').map(Number);
  const [clients, plans] = await Promise.all([safeList<any>('clients', { _active: true }, 300), safeList<any>('billing_plans', {}, 500)]);
  const retainer = new Set(plans.filter((p) => p.kind === 'retainer' && p.status === 'active').map((p) => p.client_id));
  const sorted = [...clients].sort((a, b) => Number(retainer.has(b.id)) - Number(retainer.has(a.id)) || a.name.localeCompare(b.name, 'he'));
  const client = sorted.find((c) => c.id === sp.client) ?? sorted.find((c) => retainer.has(c.id)) ?? sorted[0];
  let markers = await safeList<any>('calendar_markers', {}, 1000);
  if (!markers.some((x) => String(x.date).startsWith(`${y}-`) && x.source === 'hebcal.com')) { try { await syncIsraelCalendar(y); markers = await safeList<any>('calendar_markers', {}, 1000); } catch { /* show what we have */ } }
  const items = client ? await safeList<any>('content_items', { client_id: client.id }, 1000) : [];
  const inMonth = items.filter((i) => !i.archived_at && i.due_at && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit' }).format(new Date(i.due_at)).slice(0, 7) === month);
  const logo = logoOf(client?.profile).src;
  return <ContentCalendar month={month} canEdit={['owner', 'admin', 'account_manager'].includes(m.role)}
    clients={sorted.map((c) => ({ id: c.id, name: c.name, retainer: retainer.has(c.id) }))}
    client={client ? { id: client.id, name: client.name, logo, hasDossier: !!client.profile?.dossier } : null}
    markers={markers.filter((x) => String(x.date).slice(0, 7) === month).map((x) => ({ date: String(x.date).slice(0, 10), title: x.title, kind: x.kind, no_marketing: !!x.no_marketing }))}
    items={inMonth.map((i) => ({ id: i.id, version: i.version, topic: i.topic, idea: i.idea, post_text: i.post_text, hook: i.hook, cta: i.cta, pillar: i.pillar, hashtags: i.hashtags ?? [], format: i.format,
      platforms: i.platforms?.length ? i.platforms : i.channel ? [i.channel] : [], creative_prompt: i.creative_prompt, creative: i.creative_blob_id, slot_kind: i.slot_kind, marker: i.marker_title,
      due_at: i.due_at, status: i.social_status ?? 'idea', published_url: i.published_url, published_at: i.published_at, why: i.brief, is_winner: !!i.is_winner, win_note: i.win_note }))} />;
}
