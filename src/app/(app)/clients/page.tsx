import Link from 'next/link';
import { safeList } from '@/lib/api';
import { Hero, Table, Badge, Contract } from '@/components/ui';
import { ActionForm } from '@/components/client';
import { DEPT_HE } from '@/lib/format';
const DEPTS = Object.entries(DEPT_HE) as [string, string][];
const TEMPLATES: [string, string][] = [['real_estate', 'נדל״ן / יזמות'], ['restaurant', 'מסעדה'], ['law', 'משרד עורכי דין'], ['services', 'שירותים'], ['ecommerce', 'מסחר']];
export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams; const clients = await safeList('clients', q ? { _search: q, _active: true } : { _active: true }, 500);
  return <>
    <Hero title={<>לקוחות, <span className="mark">מותגים ופרויקטים</span></>} sub="ארגון Pixel → לקוח → מותגים/פרויקטים → התקשרויות, נכסים, משימות ותוצרים." />
    <div className="grid g2">
      <div><form className="row" style={{ marginBottom: 12 }}><input name="q" defaultValue={q} placeholder="חיפוש לקוח" style={{ maxWidth: 320 }} /><button className="btn">חיפוש</button></form>
        <Table head={['לקוח', 'מחלקה', 'תחום', 'סטטוס']} rows={clients.map((c: any) => [<Link key="l" href={`/clients/${c.id}`}><b>{c.name}</b></Link>, DEPT_HE[c.department] ?? c.department, c.industry ?? '—', <Badge key="b" s={c.status} />])} empty="אין לקוחות עדיין — הוסף לקוח או ייבא" /></div>
      <div className="card"><h2>הוספת לקוח</h2>
        <ActionForm action="create_client" redirectTo={(d) => `/clients/${d.id}`} fields={[{ name: 'name', label: 'שם הלקוח', required: true }, { name: 'industry', label: 'תחום' },
          { name: 'department', label: 'מחלקה', type: 'select', options: DEPTS, defaultValue: 'pixel_digital' }, { name: 'profile', label: 'תבנית תחום (שדות ושאלות בלבד — בלי תשובות)', type: 'select', options: TEMPLATES.map(([k, l]) => [JSON.stringify({ template: k }), l]), json: true }]} />
        <h3 style={{ marginTop: 18 }}>יבוא לקוחות קיימים</h3>
        <ActionForm action="import_clients" submit="תצוגה מקדימה ויבוא" fields={[{ name: 'rows', label: 'JSON: [{"name":"…","industry":"…","department":"pixel_nadlan"}]', type: 'textarea', json: true, ltr: true, required: true }]} extra={{ source: 'manual_import' }} />
        <p className="small muted">שמות קיימים מדולגים — לא נוצרות כפילויות.</p></div></div>
    <Contract source="office.clients" actions="יצירה, יבוא עם מניעת כפילות, פתיחת תיק" perms="מנהל לקוח רואה רק לקוחות שהוקצו לו" empty="הנחיה להוספה" />
  </>;
}
