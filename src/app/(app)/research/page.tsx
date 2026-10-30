import { safeList } from '@/lib/api';
import { Hero, Table, Badge } from '@/components/ui';
import { ActionButton, ActionForm } from '@/components/client';
import { fmtDateTime } from '@/lib/format';
export default async function Research() {
  const [rtm, trends, sources, clients] = await Promise.all([safeList('rtm_items'), safeList('trend_items'), safeList('research_sources'), safeList('clients', { _active: true })]);
  const cn = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
  return <>
    <Hero title={<>מחקר, <span className="mark">RTM וטרנדים</span></>} sub="RTM וטרנדים הם שני תהליכים שונים. נתון חסר נשאר חסר; אין ציוני ויראליות בדויים." />
    <div className="grid g2">
      <div className="card"><h2>RTM</h2><Table head={['אירוע', 'לקוח', 'חלון', 'רעיון', '']} rows={rtm.map((r: any) => [r.event_title, cn[r.client_id] ?? '—', fmtDateTime(r.response_window_until), <span key="i" className="small">{r.idea}</span>,
        r.status === 'suggested' ? <ActionButton key="a" className="btn sm" action="rtm_decision" payload={{ type: 'rtm', id: r.id, status: 'accepted', topic: r.event_title, brief: r.idea }}>פתח משימת הפקה</ActionButton> : <Badge key="b" s={r.status} />])} empty="אין פריטי RTM. הפעל ״סריקת RTM״ ללקוח מדבר עם המשרד." /></div>
      <div className="card"><h2>טרנדים</h2><Table head={['פורמט', 'לקוח', 'מדדים', 'סוג נתון', 'עד']} rows={trends.map((t: any) => [t.format, cn[t.client_id] ?? '—', t.metrics ? JSON.stringify(t.metrics) : 'חסר', t.data_kind ?? '—', t.valuable_until ?? '—'])} empty="אין טרנדים" /></div>
      <div className="card"><h2>מקורות, ענפים, מתחרים ומילות מפתח ללקוח</h2><Table head={['לקוח', 'סוג', 'ערך']} rows={sources.map((s: any) => [cn[s.client_id] ?? 'Pixel', s.kind, s.value])} />
        <ActionForm action="add_research_source" fields={[{ name: 'client_id', label: 'לקוח', type: 'select', options: clients.map((c: any) => [c.id, c.name]) }, { name: 'kind', label: 'סוג', type: 'select', required: true, options: [['site', 'אתר'], ['feed', 'פיד'], ['competitor', 'מתחרה'], ['keyword', 'מילת מפתח'], ['industry', 'ענף']] }, { name: 'value', label: 'ערך', required: true }]} /></div></div>
  </>;
}
