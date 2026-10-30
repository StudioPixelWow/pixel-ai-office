import Link from 'next/link';
import { safeList } from '@/lib/api';
import { Hero, Table, Badge, Contract } from '@/components/ui';
import { ActionForm } from '@/components/client';
import { DEPT_HE, fmtMoney } from '@/lib/format';
import { me } from '@/lib/api';
import { OnboardForm } from './onboard-form';
import { KIND_HE, serviceLabel } from '@/lib/services';
const DEPTS = Object.entries(DEPT_HE) as [string, string][];
const TEMPLATES: [string, string][] = [['real_estate', 'נדל״ן / יזמות'], ['restaurant', 'מסעדה'], ['law', 'משרד עורכי דין'], ['services', 'שירותים'], ['ecommerce', 'מסחר']];
export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams; const m = await me(); const fin = ['owner', 'admin'].includes(m.role);
  const [clients, plans, terms] = await Promise.all([safeList('clients', q ? { _search: q, _active: true } : { _active: true }, 500), fin ? safeList<any>('billing_plans', {}, 1000) : Promise.resolve([]), safeList<any>('terms_templates')]);
  const planOf = (id: string) => plans.filter((b: any) => b.client_id === id && b.status === 'active');
  return <>
    <Hero title={<>לקוחות, <span className="mark">מותגים ופרויקטים</span></>} sub="ארגון Pixel → לקוח → מותגים/פרויקטים → התקשרויות, נכסים, משימות ותוצרים." />
    <div className="grid g2">
      <div><form className="row" style={{ marginBottom: 12 }}><input name="q" defaultValue={q} placeholder="חיפוש לקוח" style={{ maxWidth: 320 }} /><button className="btn">חיפוש</button></form>
        <Table head={['לקוח', 'סוג', 'שירותים', ...(fin ? ['סכום'] : []), 'סטטוס']} rows={clients.map((c: any) => { const ps = planOf(c.id); return [<Link key="l" href={`/clients/${c.id}`}><b>{c.name}</b><div className="small muted">{DEPT_HE[c.department] ?? c.department}{c.industry ? ` · ${c.industry}` : ''}</div></Link>,
          ps.length ? [...new Set(ps.map((b: any) => KIND_HE[b.kind]))].join(' + ') : (c.profile?.client_type ? KIND_HE[c.profile.client_type] : '—'),
          <span key="s" className="small">{[...new Set(ps.flatMap((b: any) => b.services ?? []))].map(serviceLabel).join(' · ') || '—'}</span>,
          ...(fin ? [<span key="a" className="small">{ps.map((b: any) => `${fmtMoney(b.amount)}${b.kind === 'retainer' ? '/חודש' : ''}`).join(' + ') || '—'}</span>] : []), <Badge key="b" s={c.status} />]; })} empty="אין לקוחות עדיין — הוסף לקוח או ייבא" /></div>
      <div className="card"><h2>הוספת לקוח</h2>
        {fin ? <OnboardForm terms={terms.map((t: any) => ({ id: t.id, name: `${t.name}${t.vat_rate != null ? ` · מע״מ ${t.vat_rate}%` : ''}` }))} /> : <ActionForm action="create_client" redirectTo="/clients/{id}" fields={[{ name: 'name', label: 'שם הלקוח', required: true }, { name: 'industry', label: 'תחום' },
          { name: 'department', label: 'מחלקה', type: 'select', options: DEPTS, defaultValue: 'pixel_digital' }, { name: 'profile', label: 'תבנית תחום (שדות ושאלות בלבד — בלי תשובות)', type: 'select', options: TEMPLATES.map(([k, l]) => [JSON.stringify({ template: k }), l]), json: true }]} />}
        <details style={{ marginTop: 18 }}><summary><b>יבוא לקוחות קיימים</b></summary>
        <ActionForm action="import_clients" submit="תצוגה מקדימה ויבוא" fields={[{ name: 'rows', label: 'JSON: [{"name":"…","industry":"…","department":"pixel_nadlan"}]', type: 'textarea', json: true, ltr: true, required: true }]} extra={{ source: 'manual_import' }} />
        <p className="small muted">שמות קיימים מדולגים — לא נוצרות כפילויות.</p></details></div></div>
    <Contract source="office.clients" actions="יצירה, יבוא עם מניעת כפילות, פתיחת תיק" perms="מנהל לקוח רואה רק לקוחות שהוקצו לו" empty="הנחיה להוספה" />
  </>;
}
