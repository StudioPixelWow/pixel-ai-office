import { safeList, rpc, me } from '@/lib/api';
import { CarePanel } from './care';
import { AutopilotPanel } from './autopilot';
import { Hero, Table, Badge, When, Contract } from '@/components/ui';
import { ActionButton, ActionForm } from '@/components/client';
export default async function Automations() {
  const [autos, tpls, care, m] = await Promise.all([safeList('automations'), rpc<any[]>('office_workflow_templates'), rpc<any>('office_care_rules').catch(() => ({ rules: {}, stats: {} })), me()]);
  const ap = await rpc<any>('office_autopilot').catch(() => null);
  return <>
    <Hero title={<>אוטומציות</>} sub="פקודה ידנית, אירוע עסקי ותזמון משתמשים באותם תהליכים, הרשאות ומגבלות. הפעלה כפולה לא יוצרת עבודה כפולה. כל הודעת WhatsApp נשארת לאישורך." />
    {ap && <AutopilotPanel s={ap} canEdit={(m as any)?.role === 'owner'} />}
    <CarePanel rules={care?.rules ?? {}} stats={care?.stats ?? {}} canEdit={['owner', 'admin'].includes((m as any)?.role)} />
    <h2 style={{ marginTop: 26 }}>תהליכי סוכנים מתוזמנים</h2>
    <Table head={['שם', 'טריגר', 'לקוחות', 'תהליך', 'תזמון', 'מגבלות', 'ריצה אחרונה', 'הבאה', 'מצב', '']} rows={autos.map((a: any) => [a.name, a.trigger_type === 'schedule' ? 'תזמון' : `אירוע: ${a.event_key}`, a.client_scope,
      a.workflow_key, a.trigger_type === 'schedule' ? `${a.schedule_kind} ${a.schedule_day ?? a.schedule_weekday ?? ''} ${a.schedule_time ?? ''} (${a.timezone})` : '—', JSON.stringify(a.limits),
      <When key="l" d={a.last_run_at} />, <When key="n" d={a.next_run_at} />, <Badge key="b" s={a.status} />,
      <ActionButton key="x" className="btn sm" action="set_automation_status" payload={{ id: a.id, status: a.status === 'active' ? 'paused' : 'active' }}>{a.status === 'active' ? 'השהה' : 'הפעל'}</ActionButton>])} empty="אין אוטומציות" />
    <div className="grid g2" style={{ marginTop: 16 }}>
      <div className="card"><h2>אוטומציה חדשה</h2><ActionForm action="upsert_automation" fields={[
        { name: 'name', label: 'שם', required: true, defaultValue: 'תוכנית עבודה חודשית לכל הלקוחות הפעילים' }, { name: 'trigger_type', label: 'טריגר', type: 'select', required: true, options: [['schedule', 'תזמון'], ['event', 'אירוע']] },
        { name: 'schedule_kind', label: 'תדירות', type: 'select', options: [['monthly_day', 'חודשי (יום בחודש)'], ['weekly', 'שבועי'], ['daily', 'יומי']] }, { name: 'schedule_day', label: 'יום בחודש', type: 'number', defaultValue: 25 },
        { name: 'schedule_weekday', label: 'יום בשבוע (0=ראשון)', type: 'number' }, { name: 'schedule_time', label: 'שעה (Asia/Jerusalem)', type: 'time', defaultValue: '08:30' },
        { name: 'event_key', label: 'אירוע', type: 'select', options: [['lead.created', 'ליד חדש'], ['engagement.activated', 'התקשרות הופעלה'], ['conversation.inbound', 'הודעה נכנסת']] },
        { name: 'client_scope', label: 'לקוחות', type: 'select', options: [['all_active', 'כל הלקוחות הפעילים'], ['selected', 'נבחרים'], ['none', 'הקשר Pixel']] },
        { name: 'workflow_key', label: 'תהליך', type: 'select', options: tpls.map((t: any) => [t.key, t.name]), defaultValue: 'monthly_plan_client' },
        { name: 'params', label: 'פרמטרים (JSON)', type: 'textarea', json: true, ltr: true, defaultValue: '{"instruction":"הכן תוכנית עבודה לחודש הבא לכל הלקוחות הפעילים לפי השירותים והמכסות שלהם"}' }]} />
        <p className="small muted">אוטומציה חדשה נוצרת מושהית — הפעל אותה אחרי בדיקה.</p></div>
      <div className="card"><h2>תהליכי עבודה זמינים</h2>{tpls.map((t: any) => <div key={t.key} style={{ marginBottom: 10 }}><b>{t.name}</b> <span className="small muted">({t.key})</span><div className="small">{t.steps.map((s: any) => s.title).join(' → ')}</div></div>)}</div></div>
    <Contract source="office.automations + automation_fires" actions="יצירה, עריכה, הפעלה, השהיה" perms="Owner/מנהל" empty="אין אוטומציות" />
  </>;
}
