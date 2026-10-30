import { headers } from 'next/headers';
import { rpc, safeList, me } from '@/lib/api';
import { signPay } from '@/lib/paytoken';
import { gcalConfigured } from '@/engine/adapters/gcal';
import { CalendarView } from './calendar-view';
export const dynamic = 'force-dynamic';
export default async function Calendar({ searchParams }: { searchParams: Promise<{ d?: string; v?: string; g?: string }> }) {
  const sp = await searchParams; const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? '') ? sp.d! : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  const a = new Date(`${anchor}T12:00:00Z`); const from = new Date(a); from.setUTCDate(1); from.setUTCDate(from.getUTCDate() - 7); const to = new Date(a); to.setUTCMonth(to.getUTCMonth() + 1, 1); to.setUTCDate(to.getUTCDate() + 7);
  const [d, clients, m, h] = await Promise.all([rpc<any>('office_calendar', { p_from: from.toISOString(), p_to: to.toISOString() }).catch(() => ({ items: [] })), safeList<any>('clients', {}, 500), me(), headers()]);
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const feed = ['owner', 'admin'].includes(m.role) ? `${origin}/api/public/calendar/${signPay({ k: 'cal', id: m.org_id })}.ics` : null;
  return <CalendarView anchor={anchor} view={(['month', 'week', 'agenda'].includes(sp.v ?? '') ? sp.v : 'month') as any} items={d.items ?? []} google={d.google ?? null}
    gConfigured={gcalConfigured()} gFlash={sp.g ?? null} feed={feed} clients={clients.filter((c) => c.status !== 'archived').map((c) => ({ id: c.id, name: c.name }))} canConnect={['owner', 'admin'].includes(m.role)} />;
}
