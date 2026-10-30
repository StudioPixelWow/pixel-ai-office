import { headers } from 'next/headers';
import { rpc, safeList, me } from '@/lib/api';
import { signPay } from '@/lib/paytoken';
import { gcalConfigured } from '@/engine/adapters/gcal';
import { CalendarView } from './calendar-view';
import { syncIsraelCalendar } from '@/lib/israel-calendar';
export const dynamic = 'force-dynamic';
const key = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
export default async function Calendar({ searchParams }: { searchParams: Promise<{ d?: string; v?: string; g?: string }> }) {
  const sp = await searchParams; const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? '') ? sp.d! : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  const a = new Date(`${anchor}T12:00:00Z`); const from = new Date(a); from.setUTCDate(1); from.setUTCDate(from.getUTCDate() - 7); const to = new Date(a); to.setUTCMonth(to.getUTCMonth() + 1, 1); to.setUTCDate(to.getUTCDate() + 7);
  const [d, clients, m, h, gAccounts, leads] = await Promise.all([rpc<any>('office_calendar', { p_from: from.toISOString(), p_to: to.toISOString() }).catch(() => ({ items: [] })), safeList<any>('clients', {}, 500), me(), headers(), rpc<any[]>('office_google_accounts').catch(() => []), safeList<any>('leads', { _active: true }, 500)]);
  // Israeli holidays, memorial days and marketing days (Hebcal + our list) — synced once per year
  let markers = await safeList<any>('calendar_markers', {}, 1500);
  for (const y of new Set([from.getUTCFullYear(), to.getUTCFullYear()])) if (!markers.some((x) => String(x.date).startsWith(`${y}-`) && x.source === 'hebcal.com')) { try { await syncIsraelCalendar(y); markers = await safeList<any>('calendar_markers', {}, 1500); } catch { /* show what we have */ } }
  const fk = key(from), tk = key(to);
  const holidays = markers.filter((x) => x.date >= fk && x.date < tk).map((x) => ({ id: x.id, type: 'holiday', title: x.title, start: `${x.date}T12:00:00+02:00`, all_day: true,
    kind: x.kind, no_marketing: x.no_marketing, hebrew: x.hebrew, category: x.category, memo: x.memo }));
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const feed = ['owner', 'admin'].includes(m.role) ? `${origin}/api/public/calendar/${signPay({ k: 'cal', id: m.org_id })}.ics` : null;
  return <CalendarView anchor={anchor} view={(['month', 'week', 'agenda'].includes(sp.v ?? '') ? sp.v : 'month') as any} items={[...holidays, ...(d.items ?? [])]} google={d.google ?? null} gAccounts={gAccounts ?? []}
    gConfigured={gcalConfigured()} gFlash={sp.g ?? null} feed={feed} clients={clients.filter((c) => c.status !== 'archived').map((c) => ({ id: c.id, name: c.name }))} canConnect={['owner', 'admin'].includes(m.role)} leads={leads.filter((l) => !['lost', 'archived', 'engaged'].includes(l.stage)).map((l) => ({ id: l.id, name: l.company }))} />;
}
