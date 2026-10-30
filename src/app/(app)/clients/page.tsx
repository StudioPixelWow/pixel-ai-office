import Link from 'next/link';
import { safeList, me } from '@/lib/api';
import { ActionForm } from '@/components/client';
import { SheetButton } from '@/components/sheet';
import { DEPT_HE, fmtMoney } from '@/lib/format';
import { OnboardForm } from './onboard-form';
import { KIND_HE, serviceLabel } from '@/lib/services';
const DEPTS = Object.entries(DEPT_HE) as [string, string][];
const ST: Record<string, [string, string]> = { onboarding: ['בהקמה', 'warn'], active: ['פעיל', 'ok'], paused: ['מושהה', 'muted'], ended: ['הסתיים', 'muted'] };
export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string; s?: string; d?: string }> }) {
  const { q, s, d } = await searchParams; const m = await me(); const fin = ['owner', 'admin'].includes(m.role);
  const [all, plans, terms] = await Promise.all([safeList<any>('clients', q ? { _search: q, _active: true } : { _active: true }, 500), fin ? safeList<any>('billing_plans', {}, 1000) : Promise.resolve([]), safeList<any>('terms_templates')]);
  const clients = all.filter((c) => (!s || c.status === s) && (!d || c.department === d));
  const planOf = (id: string) => plans.filter((b: any) => b.client_id === id && b.status === 'active');
  const mrr = plans.filter((b: any) => b.status === 'active' && b.kind === 'retainer').reduce((a: number, b: any) => a + Number(b.amount ?? 0), 0);
  const href = (k: Record<string, string | undefined>) => { const u = new URLSearchParams(Object.entries({ q, s, d, ...k }).filter(([, v]) => v) as any); return `/clients${u.size ? `?${u}` : ''}`; };
  const termsOpts = terms.map((t: any) => ({ id: t.id, name: `${t.name}${t.vat_rate != null ? ` · מע״מ ${t.vat_rate}%` : ''}` }));
  return <>
    <section className="pg-head"><div><h1>לקוחות</h1><p>כל לקוח: תיק מותג, אבני דרך, תוכן, תשלומים וסוכנים — במקום אחד.</p></div>
      <div className="row"><SheetButton label="＋ לקוח חדש" title="לקוח חדש">{fin ? <OnboardForm terms={termsOpts} /> : <ActionForm action="create_client" redirectTo="/clients/{id}" fields={[{ name: 'name', label: 'שם הלקוח', required: true }, { name: 'industry', label: 'תחום' }, { name: 'department', label: 'מחלקה', type: 'select', options: DEPTS, defaultValue: 'pixel_digital' }]} />}</SheetButton>
        <SheetButton className="btn ghost" label="יבוא" title="יבוא לקוחות קיימים"><ActionForm action="import_clients" submit="תצוגה מקדימה ויבוא" fields={[{ name: 'rows', label: 'JSON: [{"name":"…","industry":"…","department":"pixel_nadlan"}]', type: 'textarea', json: true, ltr: true, required: true }]} extra={{ source: 'manual_import' }} /><p className="small muted">שמות קיימים מדולגים — לא נוצרות כפילויות.</p></SheetButton></div></section>
    <div className="kpis">
      <div className="kpi"><b>{all.filter((c) => c.status === 'active').length}</b><span>לקוחות פעילים</span></div>
      <div className="kpi"><b>{all.filter((c) => c.status === 'onboarding').length}</b><span>בהקמה</span></div>
      <div className="kpi"><b>{all.filter((c) => c.profile?.dossier).length}</b><span>עם תיק מותג</span></div>
      {fin && <div className="kpi"><b>{fmtMoney(mrr)}</b><span>ריטיינרים חודשיים</span></div>}
      <div className="kpi"><b>{all.length}</b><span>סה״כ</span></div>
    </div>
    <div className="row" style={{ marginBottom: 14 }}>
      <form className="search" action="/clients"><span aria-hidden>⌕</span><input name="q" defaultValue={q} placeholder="חיפוש לקוח…" />{s && <input type="hidden" name="s" value={s} />}<button className="btn sm">חפש</button></form>
      <div className="chips">{([[undefined, 'הכל'], ['active', 'פעילים'], ['onboarding', 'בהקמה'], ['paused', 'מושהים']] as const).map(([v, l]) => <Link key={l} href={href({ s: v })} className={s === v ? 'on' : ''}>{l}</Link>)}</div>
      <div className="chips">{DEPTS.map(([k, l]) => <Link key={k} href={href({ d: d === k ? undefined : k })} className={d === k ? 'on' : ''}>{l}</Link>)}</div>
    </div>
    {clients.length ? <div className="cgrid">{clients.map((c) => { const ps = planOf(c.id); const logo = c.profile?.dossier?.brand?.logo_url ?? c.profile?.dossier_extra?.logo; const st = ST[c.status] ?? [c.status, 'muted'];
      const svc = [...new Set(ps.flatMap((b: any) => b.services ?? []))].map(serviceLabel);
      return <Link key={c.id} href={`/clients/${c.id}`} className="ccard">
        <div className="bc-h"><span className="av">{logo ? <img src={logo} alt="" /> : (c.name ?? '?').slice(0, 1)}</span><div><b>{c.name}</b><small>{DEPT_HE[c.department] ?? c.department}{c.industry ? ` · ${c.industry}` : ''}</small></div></div>
        {svc.length > 0 && <div className="bc-tags">{svc.slice(0, 4).map((x) => <span key={x}>{x}</span>)}</div>}
        <div className="cc-meta"><span className={`badge ${st[1]}`}>{st[0]}</span>{c.profile?.dossier ? <span>✓ תיק מותג</span> : <span>ללא מחקר</span>}
          {fin && ps.length > 0 && <span>{ps.map((b: any) => `${fmtMoney(b.amount)}${b.kind === 'retainer' ? '/ח׳' : ''}`).join(' + ')}</span>}</div>
      </Link>; })}</div> : <div className="onb"><h2>{q || s || d ? 'אין תוצאות לסינון הזה' : 'אין לקוחות עדיין'}</h2><p>לקוחות נפתחים אוטומטית כשליד חותם על הצעה — או ידנית מהכפתור למעלה.</p></div>}
  </>;
}
