import { w } from '@/engine/db';
import { verifyPay } from '@/lib/paytoken';
// Read-only ICS feed (subscribe from Google/Apple/Outlook). The link is signed; anyone with it can read the office calendar titles.
const esc = (s: string) => String(s ?? '').replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
const dt = (s: string) => new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dd = (s: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(s)).replace(/-/g, '');
const next = (d: string) => { const x = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10).replace(/-/g, ''); };
export async function GET(_: Request, { params }: { params: Promise<{ t: string }> }) {
  const { t } = await params; const p = verifyPay(t.replace(/\.ics$/, '')); if (!p || p.k !== 'cal') return new Response('not found', { status: 404 });
  const f: any = await w('office_worker_calendar_feed', {}).catch(() => null); if (!f) return new Response('unavailable', { status: 503 });
  const now = dt(new Date().toISOString()); const L: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PIXEL AI OFFICE//HE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:PIXEL AI OFFICE', 'X-WR-TIMEZONE:Asia/Jerusalem'];
  for (const m of f.meetings ?? []) { L.push('BEGIN:VEVENT', `UID:m-${m.id}@pixel`, `DTSTAMP:${now}`, ...(m.all_day ? [`DTSTART;VALUE=DATE:${dd(m.start)}`, `DTEND;VALUE=DATE:${next(dd(m.end ?? m.start))}`] : [`DTSTART:${dt(m.start)}`, `DTEND:${dt(m.end ?? m.start)}`]),
    `SUMMARY:${esc(m.title)}${m.client ? esc(` · ${m.client}`) : ''}`, ...(m.location ? [`LOCATION:${esc(m.location)}`] : []), 'END:VEVENT'); }
  for (const x of f.todos ?? []) { const d = dd(x.due); L.push('BEGIN:VEVENT', `UID:t-${x.id}@pixel`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next(d)}`, `SUMMARY:${esc(`☐ ${x.title}`)}`, 'END:VEVENT'); }
  for (const x of f.milestones ?? []) { const d = String(x.date).replace(/-/g, ''); L.push('BEGIN:VEVENT', `UID:ms-${x.id}@pixel`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next(d)}`, `SUMMARY:${esc(`◆ ${x.title} · ${x.client}`)}`, 'END:VEVENT'); }
  L.push('END:VCALENDAR');
  return new Response(L.join('\r\n'), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'private, max-age=300' } });
}
