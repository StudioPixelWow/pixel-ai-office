import 'server-only';
import { w } from '@/engine/db';
// Israeli calendar for the content Gantt: Jewish & national holidays from Hebcal (Israel schedule, Hebrew titles) + a curated list of
// marketing days. Memorial days, Tisha B'Av and Yom Kippur are flagged no_marketing — the planner never places a promotional post there.
type M = { date: string; title: string; kind: string; no_marketing?: boolean; category?: string; hebrew?: string; memo?: string; source: string };
const NO_MKT = /Yom HaShoah|Yom HaZikaron|Tish'a B'Av|Yom Kippur$|Yom HaZikaron LaShoah/i;
const SENSITIVE = /Rabin|Tzom|Ta'anit|Asara B'Tevet|Shiva Asar|Gedaliah/i;
function marketingDays(year: number): M[] {
  const d = (m: number, day: number) => `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const nthDow = (m: number, dow: number, n: number) => { const first = new Date(Date.UTC(year, m - 1, 1)); const off = (dow - first.getUTCDay() + 7) % 7; return new Date(Date.UTC(year, m - 1, 1 + off + (n - 1) * 7)); };
  const bf = nthDow(11, 5, 4); const cm = new Date(bf.getTime() + 3 * 864e5); const iso = (x: Date) => x.toISOString().slice(0, 10);
  const src = 'ימים שיווקיים (Pixel)';
  return [
    { date: d(1, 1), title: 'שנה אזרחית חדשה', kind: 'special', source: src }, { date: d(2, 14), title: 'ולנטיין', kind: 'special', source: src },
    { date: d(3, 8), title: 'יום האישה הבינלאומי', kind: 'special', source: src }, { date: d(9, 1), title: 'פתיחת שנת הלימודים', kind: 'special', source: src },
    { date: d(11, 11), title: 'Singles Day 11.11', kind: 'special', source: src }, { date: iso(bf), title: 'בלאק פריידי', kind: 'special', source: src },
    { date: iso(cm), title: 'סייבר מאנדיי', kind: 'special', source: src }, { date: d(12, 31), title: 'סילבסטר', kind: 'special', source: src },
  ];
}
export async function syncIsraelCalendar(year: number) {
  const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=off&ss=off&mf=on&c=off&s=off&i=on&lg=he&year=${year}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(12000), next: { revalidate: 86400 } } as any);
  if (!r.ok) throw new Error(`hebcal ${r.status}`);
  const j: any = await r.json();
  const items: M[] = (j.items ?? []).filter((x: any) => x.date && !['roshchodesh', 'parashat', 'candles', 'havdalah', 'omer', 'mevarchim'].includes(x.category))
    .map((x: any) => { const orig = String(x.title_orig ?? x.title ?? '');
      const erev = /^Erev /.test(orig);
      return { date: String(x.date).slice(0, 10), title: String(x.title ?? orig).slice(0, 200), kind: NO_MKT.test(orig) ? 'memorial' : erev ? 'erev' : x.subcat === 'fast' ? 'fast' : x.subcat === 'modern' ? 'national' : 'holiday',
        no_marketing: NO_MKT.test(orig), category: [x.category, x.subcat, SENSITIVE.test(orig) ? 'sensitive' : null].filter(Boolean).join(':'), hebrew: x.hebrew ?? null, memo: x.memo ?? null, source: 'hebcal.com' }; });
  const all = [...items, ...marketingDays(year)];
  return w<number>('office_worker_upsert_markers', { p_markers: all });
}
