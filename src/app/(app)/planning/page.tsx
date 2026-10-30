import { safeList } from '@/lib/api';
import { Hero, Table, Badge, Contract } from '@/components/ui';
import { ActionForm } from '@/components/client';
import { fmtDateTime } from '@/lib/format';
import { Gantt } from './gantt';
export default async function Planning({ searchParams }: { searchParams: Promise<{ m?: string; client?: string }> }) {
  const sp = await searchParams; const base = /^\d{4}-\d{2}$/.test(sp.m ?? '') ? new Date(sp.m + '-01T00:00:00Z') : new Date(); const y = base.getUTCFullYear(), mo = base.getUTCMonth();
  const [items, clients, meetings, markers] = await Promise.all([safeList('content_items', sp.client ? { client_id: sp.client, _active: true } : { _active: true }, 1000), safeList('clients', { _active: true }), safeList('meetings', {}, 200), safeList('calendar_markers', {}, 200)]);
  const inMonth = items.filter((i: any) => i.due_at && new Date(i.due_at).getUTCMonth() === mo && new Date(i.due_at).getUTCFullYear() === y);
  const cn = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
  const prev = new Date(Date.UTC(y, mo - 1, 1)).toISOString().slice(0, 7), next = new Date(Date.UTC(y, mo + 1, 1)).toISOString().slice(0, 7);
  return <>
    <Hero title={<>גאנט תוכן, <span className="mark">פרויקטים ויומן</span></>} sub="לוח תוכן, תוכנית פרויקט ויומן פגישות — נפרדים ומחוברים דרך משימות. זמנים נשמרים ב-UTC ומוצגים לפי Asia/Jerusalem." />
    <form className="row" style={{ marginBottom: 12 }}><a className="btn sm" href={`?m=${prev}${sp.client ? `&client=${sp.client}` : ''}`}>‹ חודש קודם</a><b>{new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(base)}</b>
      <a className="btn sm" href={`?m=${next}${sp.client ? `&client=${sp.client}` : ''}`}>חודש הבא ›</a><input type="hidden" name="m" value={`${y}-${String(mo + 1).padStart(2, '0')}`} />
      <select name="client" defaultValue={sp.client ?? ''} style={{ width: 220 }}><option value="">כל הלקוחות</option>{clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn">סינון</button></form>
    <Gantt year={y} month={mo} items={inMonth.map((i: any) => ({ id: i.id, topic: i.topic, due_at: i.due_at, status: i.production_status, client: cn[i.client_id] ?? '', version: i.version }))}
      markers={markers.filter((x: any) => new Date(x.date).getUTCMonth() === mo && new Date(x.date).getUTCFullYear() === y).map((x: any) => ({ date: x.date, title: x.title }))} />
    <p className="small muted">גרירה של פריט ליום אחר משנה את המועד ומתועדת; גם מקלדת: בחר פריט ולחץ חץ ימינה/שמאלה. שינוי מועד אינו משנה מכסות.</p>
    <div className="grid g2" style={{ marginTop: 16 }}>
      <div className="card"><h2>יומן פגישות</h2><Table head={['פגישה', 'לקוח', 'מתי', 'סטטוס']} rows={meetings.map((x: any) => [x.title, cn[x.client_id] ?? '—', fmtDateTime(x.starts_at), <Badge key="b" s={x.status} />])} empty="אין פגישות. יומן Google/Outlook טרם חובר — פגישות נרשמות ידנית." />
        <h3 style={{ marginTop: 14 }}>פגישה חדשה</h3><ActionForm action="create_meeting" fields={[{ name: 'title', label: 'כותרת', required: true }, { name: 'client_id', label: 'לקוח', type: 'select', options: clients.map((c: any) => [c.id, c.name]) },
          { name: 'starts_at', label: 'התחלה', type: 'datetime-local', required: true }, { name: 'ends_at', label: 'סיום', type: 'datetime-local', required: true }, { name: 'location', label: 'מיקום' }, { name: 'prep_notes', label: 'הכנה', type: 'textarea' }]} /></div>
      <div className="card"><h2>חגים ואירועים</h2><p className="small muted">נטענים ממקור אמין או ידנית — לא מומצאים.</p>
        <Table head={['תאריך', 'אירוע', 'מקור']} rows={markers.map((x: any) => [x.date, x.title, x.source])} />
        <ActionForm action="add_calendar_marker" fields={[{ name: 'date', label: 'תאריך', type: 'date', required: true }, { name: 'title', label: 'אירוע', required: true }, { name: 'source', label: 'מקור', required: true, hint: 'למשל: לוח השנה הרשמי / ידני' }]} />
        <h3 style={{ marginTop: 14 }}>פריט תוכן ידני</h3><ActionForm action="create_content_item" fields={[{ name: 'client_id', label: 'לקוח', type: 'select', required: true, options: clients.map((c: any) => [c.id, c.name]) }, { name: 'topic', label: 'נושא', required: true },
          { name: 'format', label: 'פורמט' }, { name: 'channel', label: 'ערוץ' }, { name: 'due_at', label: 'מועד', type: 'datetime-local' }, { name: 'brief', label: 'בריף', type: 'textarea' }]} />
        <p className="small muted">פריט ידני שאינו משויך למכסה מסומן כתוספת להחלטתך.</p></div></div>
    <Contract source="content_items, meetings, calendar_markers" actions="גרירת מועד, פגישה, חג/אירוע, פריט ידני" perms="מנהל לקוח ומעלה" empty="חודש ריק" />
  </>;
}
