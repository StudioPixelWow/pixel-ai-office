import 'server-only';
import { w } from './db';
import { metaConfigured, metaInsights, metaDaily } from './adapters/meta';
import { adsConfigured, adsMonth, adsDaily, ga4Month, marketingToken } from './adapters/gmarketing';
const TZ = 'Asia/Jerusalem';
const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
// Once a day (06:00–10:00): pull month-to-date (+ last month in the first 5 days) for every client with mapped accounts, then run the budget guard.
export async function adsSync() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date())); if (h < 6 || h > 10) return { skipped: true };
  const hasG = !!(await marketingToken().catch(() => null));
  const hasM = await metaConfigured();
  if (!hasM && !hasG) return { skipped: 'no_connections' };
  const list: any[] | null = await w('office_worker_metric_targets', {}); if (!list) return { skipped: 'done_today' };
  const now = new Date(); const today = ymd(now); const m0 = `${today.slice(0, 7)}-01`;
  const prev = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1)); const p0 = prev.toISOString().slice(0, 10); const p1 = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 0)).toISOString().slice(0, 10);
  const ranges: [string, string][] = [[m0, today], ...(Number(today.slice(8, 10)) <= 5 ? [[p0, p1] as [string, string]] : [])];
  const out = { clients: 0, errors: [] as string[], alerts: 0 };
  for (const c of list) {
    const s = c.sources ?? {}; out.clients++;
    for (const [a, b] of ranges) {
      if (s.meta && hasM) await metaInsights(s.meta, a, b).then((d) => w('office_worker_metrics_save', { p_client: c.client_id, p_month: a, p_source: 'meta', p_data: d })).catch((e) => out.errors.push(`meta ${c.client}: ${e.message}`));
      if (s.google_ads && hasG && adsConfigured()) await adsMonth(s.google_ads, a, b).then((d) => w('office_worker_metrics_save', { p_client: c.client_id, p_month: a, p_source: 'google_ads', p_data: d })).catch((e) => out.errors.push(`ads ${c.client}: ${e.message}`));
      if (s.ga4 && hasG) await ga4Month(s.ga4, a, b).then((d) => w('office_worker_metrics_save', { p_client: c.client_id, p_month: a, p_source: 'ga4', p_data: d })).catch((e) => out.errors.push(`ga4 ${c.client}: ${e.message}`));
    }
    out.alerts += await budgetGuard(c, s, hasG, hasM).catch(() => 0);
  }
  await w('office_worker_metrics_done', {});
  return out;
}
// שומר התקציב — yesterday vs. the 7 days before: CPL jump, spend with no results, paused/disabled account, monthly pace.
async function budgetGuard(c: any, s: any, hasG: boolean, hasM: boolean) {
  let n = 0; const alert = async (key: string, title: string) => { if (await w('office_worker_budget_alert', { p_client: c.client_id, p_key: key, p_title: title })) n++; };
  if (s.meta && hasM) {
    const d = await metaDaily(s.meta, 8); const days = d.days.slice(-8); const y = days[days.length - 1]; const base = days.slice(0, -1);
    if (d.account?.account_status && d.account.account_status !== 1) await alert('meta_status', `🛑 חשבון Meta של ${c.client} אינו פעיל (סטטוס ${d.account.account_status}) — הקמפיינים לא רצים`);
    if (y && base.length >= 3) {
      const bs = base.reduce((a: number, x: any) => a + x.spend, 0), bl = base.reduce((a: number, x: any) => a + x.leads, 0);
      const bcpl = bl ? bs / bl : null; const ycpl = y.leads ? y.spend / y.leads : null;
      if (bcpl && ycpl && ycpl > bcpl * 1.6 && y.spend > 50) await alert('meta_cpl', `📈 ${c.client} · Meta: עלות לליד אתמול ₪${Math.round(ycpl)} לעומת ₪${Math.round(bcpl)} בממוצע השבוע`);
      if (y.spend > 150 && !y.leads && bl > 0) await alert('meta_noleads', `⚠️ ${c.client} · Meta: הוצאה של ₪${Math.round(y.spend)} אתמול בלי אף ליד`);
      if (bs > 0 && y.spend === 0) await alert('meta_zero', `⏸️ ${c.client} · Meta: אפס הוצאה אתמול — ייתכן שהקמפיינים נעצרו או שהתשלום נכשל`);
    }
    if (s.monthly_budget) { const spent = d.days.reduce((a: number, x: any) => a + x.spend, 0) / Math.max(1, d.days.length) * 30; if (spent > s.monthly_budget * 1.2) await alert('meta_pace', `💸 ${c.client} · Meta בקצב של ₪${Math.round(spent)} לחודש מול תקציב ₪${s.monthly_budget}`); }
  }
  if (s.google_ads && hasG && adsConfigured()) {
    const d = await adsDaily(s.google_ads); const days = d.slice(-8); const y = days[days.length - 1]; const base = days.slice(0, -1);
    if (y && base.length >= 3) { const bs = base.reduce((a: number, x: any) => a + x.spend, 0);
      if (bs > 0 && y.spend === 0) await alert('gads_zero', `⏸️ ${c.client} · Google Ads: אפס הוצאה אתמול — לבדוק תקציב/חיוב/מודעות`);
      const bc = base.reduce((a: number, x: any) => a + x.conversions, 0); if (y.spend > 150 && !y.conversions && bc > 0) await alert('gads_noconv', `⚠️ ${c.client} · Google Ads: ₪${Math.round(y.spend)} אתמול בלי המרות`); }
  }
  return n;
}
