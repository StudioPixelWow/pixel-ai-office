import { safeList } from '@/lib/api';
import { Hero, Table, Empty } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
export default async function Media() {
  const [accounts, snaps, log, clients] = await Promise.all([safeList('ad_accounts'), safeList('metric_snapshots', {}, 50), safeList('campaign_change_log', {}, 50), safeList('clients')]);
  const cn = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
  return <>
    <Hero title={<>מדיה, <span className="mark">ביצועים ומדידה</span></>} sub="נתונים שנשלפו, חישובים והמלצות מוצגים בנפרד, עם טווח זמן ומקור. כשאין חיבור — מוצג מצב חסר, לא מספרים." />
    <div className="grid g2">
      <div className="card"><h2>חשבונות פרסום משויכים</h2><Table head={['לקוח', 'פלטפורמה', 'חשבון', 'כתיבה מותרת', 'תקרת שינוי יומית']} rows={accounts.map((a: any) => [cn[a.client_id], a.platform, <span key="i" dir="ltr">{a.external_account_id}</span>, a.write_permitted ? 'כן' : 'לא — הצעות בלבד', a.daily_change_cap ?? '—'])}
        empty="לא שויכו חשבונות פרסום. חיבור Meta/Google Ads נדרש לשליפת נתונים; בדיקות חיבור לא מפעילות מודעות ולא מוציאות כסף." /></div>
      <div className="card"><h2>נתונים שנשלפו</h2>{snaps.length ? <Table head={['לקוח', 'מקור', 'טווח', 'נשלף']} rows={snaps.map((s: any) => [cn[s.client_id], s.source, `${s.date_from} – ${s.date_to}`, fmtDateTime(s.pulled_at)])} /> : <Empty>אין נתונים — אין חיבור פעיל. לא מוצגים ROAS/הכנסות בלי נתונים.</Empty>}</div>
      <div className="card"><h2>היסטוריית שינויים והמלצות</h2><Table head={['סוג', 'סיכום', 'מתי']} rows={log.map((l: any) => [l.kind, l.summary, fmtDateTime(l.created_at)])} empty="אין שינויים" /></div></div>
  </>;
}
