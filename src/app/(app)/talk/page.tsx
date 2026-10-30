import Link from 'next/link';
import { safeList, list, me } from '@/lib/api';
import { Hero, Badge, Table, When, Contract } from '@/components/ui';
import { TalkForm } from './talk-form';
import { ActionButton } from '@/components/client';

export default async function Talk({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams; const m = await me();
  const [clients, projects, reqs] = await Promise.all([safeList('clients', { _active: true }), safeList('projects', { _active: true }), safeList('requests', {}, 30)]);
  const cur = r ? reqs.find((x: any) => x.id === r) ?? null : null;
  const tasks = cur ? await list('task_runs', { request_id: cur.id }, 200) : [];
  return <>
    <Hero title={<>דבר עם <span className="mark">המשרד</span></>} sub="בקשה חופשית → המערכת מבדילה בין תשובה, טיוטה ופתיחת עבודה, ומפעילה רק את התפקידים הרלוונטיים." />
    <div className="grid g2">
      <div className="card"><TalkForm clients={clients.map((c: any) => [c.id, c.name])} projects={projects.map((p: any) => [p.id, p.name, p.client_id])} canAll={['owner', 'admin'].includes(m.role)} /></div>
      <div className="card">{cur ? <>
        <div className="row"><h2 className="sp">הבקשה</h2><Badge s={cur.status} />
          {['running', 'planning'].includes(cur.status) && <ActionButton className="btn sm" action="pause_request" payload={{ request_id: cur.id }}>השהה</ActionButton>}
          {cur.status === 'paused' && <ActionButton className="btn sm" action="resume_request" payload={{ request_id: cur.id }}>המשך</ActionButton>}
          {!['done', 'cancelled'].includes(cur.status) && <ActionButton className="btn danger sm" action="cancel_run" payload={{ request_id: cur.id }} confirm="לבטל את המשך העבודה? תוצרים שכבר הופקו יישמרו.">בטל</ActionButton>}</div>
        <p>{cur.text}</p>
        {cur.answer && <pre className="out">{cur.answer}</pre>}
        <h3>משימות שנפתחו ({tasks.length})</h3>
        <Table head={['משימה', 'סוכן', 'מצב', 'חסם']} rows={tasks.map((t: any) => [<Link key="l" href={`/tasks/${t.id}`}>{t.title}</Link>, t.agent_id ?? '—', <Badge key="b" s={t.status} />, <span key="x" className="small">{t.blocker ?? ''}</span>])} empty="לא נפתחו משימות (תשובה בלבד או אין לקוחות רלוונטיים)" />
      </> : <><h2>דוגמאות</h2><ul className="small">
        <li>תכין גאנט לחודש הבא ללקוח שבחרתי, לפי החבילה שלו</li><li>תן לי שלושה כיווני קריאייטיב ותפתח משימות לכיוון שאבחר</li>
        <li>מה תקוע היום ומחכה להחלטה שלי?</li><li>תכין פולואפ להצעה הזאת ותציג לי לאישור</li><li>תכין סרטון מהחומרים בתיק הפרויקט לפי השפה של הלקוח</li>
        <li>תכין את תוכנית העבודה לחודש הבא לכל הלקוחות הפעילים לפי השירותים והמכסות שלהם</li></ul></>}</div>
    </div>
    <div className="card" style={{ marginTop: 16 }}><h2>בקשות אחרונות</h2>
      <Table head={['בקשה', 'מקור', 'היקף', 'מצב', 'נוצר']} rows={reqs.map((q: any) => [<Link key="l" href={`/talk?r=${q.id}`}>{q.text.slice(0, 90)}</Link>, q.source, q.scope, <Badge key="b" s={q.status} />, <When key="w" d={q.created_at} />])} /></div>
    <Contract source="office.requests + task_runs" actions="פקודה ידנית / השהיה / ביטול; כל משימה קיימת גם במסכי המשימות והסוכנים" perms="מנהל לקוח ומעלה; 'כל הלקוחות' — Owner/מנהל" empty="הצגת דוגמאות" />
  </>;
}
