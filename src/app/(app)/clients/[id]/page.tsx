import Link from 'next/link';
import { get, safeList, rpc, me } from '@/lib/api';
import { Badge, Table, Tabs, Empty, When } from '@/components/ui';
import { ActionForm, ActionButton } from '@/components/client';
import { DEPT_HE, fmtMoney, fmtDateTime } from '@/lib/format';
import { notFound } from 'next/navigation';
import { OnboardForm } from '../onboard-form';
import { ResearchPanel } from './research-panel';
import { BrandBook, AssetBank } from './brand-book';
import { SamplesForm } from './samples-form';
import { KIND_HE, VAT_MODE_HE, PAY_STATUS_HE, serviceLabel } from '@/lib/services';
import { fmtDate } from '@/lib/format';
import { JourneyBar } from '@/components/journey';
import { Milestones } from './milestones';
import { ProfileForm } from './profile-form';
import { PortalCard } from './portal-card';
import { DocsPanel } from './docs-panel';
import { ReportsPanel } from './reports-panel';
import { ClientSources } from '@/components/data-sources';
import { Opportunities } from '@/components/opportunities';
import { AdsTable } from '@/components/ads-table';


const ONB_Q: Record<string, string> = { unique: 'מה מייחד', audience: 'קהל', competitors: 'מתחרים', goals: 'מטרות ל-3 חודשים', tone: 'טון', avoid: 'להימנע', dates: 'תאריכים חשובים' };
export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params; const { tab = 'overview' } = await searchParams; const m = await me();
  const c = await get<any>('clients', id); if (!c) notFound();
  const [projects, contacts, assets, engagements, periods, knowledge, tasks, arts, items] = await Promise.all([
    safeList('projects', { client_id: id }), safeList('contacts', { client_id: id }), safeList('client_assets', { client_id: id }), safeList('engagements', { client_id: id }),
    safeList('service_periods', { client_id: id }), safeList('knowledge_items', { client_id: id }), safeList('task_runs', { client_id: id }, 50), safeList('artifacts', { client_id: id }, 50), safeList('content_items', { client_id: id }, 100)]);
  const [journey, milestones] = await Promise.all([rpc<any>('office_journey', { p_client: id }).catch(() => null), tab === 'milestones' || tab === 'overview' ? rpc<any[]>('office_client_milestones', { p_client: id }).catch(() => []) : Promise.resolve([])]);
  const ents = engagements.length ? await safeList('service_entitlements', { engagement_id: engagements.map((e: any) => e.id) }) : [];
  const quota = periods[0] ? await rpc<any[]>('office_quota', { p_period: periods[0].id }).catch(() => []) : [];
  const [portal, opps, site] = await Promise.all([rpc<string>('office_portal_link', { p_client: id }).catch(() => ''), tab === 'overview' ? rpc<any[]>('office_opportunities', { p_client: id }).catch(() => []) : Promise.resolve([] as any[]), tab === 'overview' ? rpc<any>('office_site_check', { p_client: id }).catch(() => null) : Promise.resolve(null)]);
  const [steps, onb, ads] = await Promise.all([rpc<Record<string, any>>('office_next_steps').catch(() => ({} as any)), tab === 'overview' ? rpc<any>('office_client_onboarding', { p_client: id }).catch(() => null) : Promise.resolve(null), tab === 'overview' ? rpc<any>('office_ads_overview', { p_month: null }).catch(() => null) : Promise.resolve(null)]);
  const adRow = (ads?.rows ?? []).find((x: any) => x.id === id);
  const ns = steps?.[id];
  const base = `/clients/${id}?tab=`; const fin = ['owner', 'admin'].includes(m.role);
  const [plans, pays, terms] = fin && tab === 'billing' ? await Promise.all([safeList<any>('billing_plans', { client_id: id }), safeList<any>('payments', { client_id: id }, 500), safeList<any>('terms_templates')]) : [[], [], []];
  return <>
    <div className="hero"><div className="row"><div className="sp"><h1>{c.name}</h1><p>{DEPT_HE[c.department] ?? c.department} · {c.industry ?? 'תחום לא הוגדר'} {c.is_test && '· [בדיקה]'}</p>
      {(() => { const web: string | undefined = c.profile?.website; const so: Record<string, string> = c.profile?.socials ?? {}; const other: string[] = c.profile?.other_sites ?? [];
        const L: [string, string][] = [['facebook', 'פייסבוק'], ['instagram', 'אינסטגרם'], ['linkedin', 'לינקדאין'], ['tiktok', 'טיקטוק'], ['youtube', 'יוטיוב']];
        const links = [...(web ? [['🌐 ' + web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), web]] : []), ...other.map((u) => ['🌐 ' + u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), u]), ...L.filter(([k]) => so[k]).map(([k, l]) => [l, so[k]])];
        return links.length ? <div className="cl-links">{links.map(([l, u]) => <a key={u} href={u} target="_blank" rel="noreferrer">{l}</a>)}</div> : <div className="cl-links muted">אין עדיין אתר ורשתות בכרטיס</div>; })()}</div><Badge s={c.status} /></div></div>
    {ns && <div className={`next-step big ${ns.tone}`}><i>➜</i><span className="sp"><small>הצעד הבא</small>{ns.text}</span>{ns.link && <Link className="btn sm" href={ns.link}>לטיפול</Link>}</div>}
    <JourneyBar j={journey} />
    <Tabs on={base + tab} items={[[base + 'overview', 'סקירה'], [base + 'milestones', 'אבני דרך'], ...(fin ? [[base + 'billing', 'תשלומים'] as [string, string]] : []), [base + 'services', 'שירותים ומכסות'], [base + 'projects', 'מותגים ופרויקטים'], [base + 'contacts', 'אנשי קשר'], [base + 'docs', 'מסמכים וחוזים'], [base + 'reports', 'דוחות'], [base + 'knowledge', 'תיק מותג ומחקר'], [base + 'assets', 'בנק נכסים'], [base + 'work', 'משימות ותוצרים']]} />
    {tab === 'overview' && <div className="grid g2 ov">
      <ProfileForm c={c} />
      <div className="grid" style={{ alignContent: 'start' }}>
        {onb?.started && <div className="card onb-card"><div className="row"><h2 className="sp">קליטה בפורטל</h2><b>{onb.pct}%</b></div>
          <div className="pt-onb-bar"><i style={{ width: `${onb.pct}%` }} /></div>
          <ul className="onb-steps">{(onb.steps ?? []).map((x: any) => <li key={x.key} className={x.done ? 'ok' : ''}>{x.done ? '✓' : '○'} {x.label}{x.note ? <small> · {x.note}</small> : null}
            {(x.files ?? []).map((f: any) => <a key={f.blob} href={`/api/files/${f.blob}?download=${encodeURIComponent(f.name ?? 'file')}`}> 📎 {f.name}</a>)}</li>)}</ul>
          {onb.answers && Object.keys(onb.answers).length > 0 && <details><summary className="small"><b>תשובות השאלון</b></summary><dl className="onb-ans">{Object.entries(onb.answers).flatMap(([k, v]) => [<dt key={k + 'k'}>{ONB_Q[k] ?? k}</dt>, <dd key={k + 'v'}>{String(v)}</dd>])}</dl></details>}</div>}
        {adRow && <div className="card ad-one"><div className="row"><h2 className="sp">ביצועי פרסום החודש</h2><Link className="btn sm ghost" href="/ads">כל הלקוחות</Link></div><AdsTable rows={[adRow]} single /></div>}
        {portal && <PortalCard clientId={id} url={portal} onb={!!onb?.started} />}
        {site && <div className="card sc"><h2>{site.ok ? '✅' : '🔧'} בריאות האתר</h2><p className="small muted">בדיקה אחרונה {fmtDateTime(site.at)} · {site.result?.ms ? `${Math.round(site.result.ms / 100) / 10} שנ׳` : ''}{site.result?.https ? ' · HTTPS ✓' : ''}{site.result?.form ? ' · טופס ✓' : ''}</p>
          {(site.result?.pixels ?? []).length > 0 && <p className="small">מדידה: {site.result.pixels.join(' · ')}</p>}
          {(site.result?.issues ?? []).length > 0 && <ul className="small" style={{ color: 'var(--bad)', margin: 0 }}>{site.result.issues.map((x: string) => <li key={x}>{x}</li>)}</ul>}</div>}
        {opps.length > 0 && <div className="card"><h2>💡 הזדמנויות להגדלה</h2><Opportunities items={opps} compact /></div>}
        <div className="card"><h2>אבני דרך קרובות</h2>{milestones.filter((x: any) => !['done', 'skipped'].includes(x.status)).slice(0, 6).map((x: any) => <div key={x.id} className="ov-ms"><span className={`dotx ${x.due_date && x.due_date < new Date().toISOString().slice(0, 10) ? 'late' : ''}`} /><div><b>{x.title}</b><small>{x.service} · {x.due_date ? new Date(x.due_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : '—'}</small></div></div>)}
          {!milestones.length && <p className="muted">אין עדיין אבני דרך — הן נוצרות כשנפתחת עסקה.</p>}<Link className="btn sm ghost" href={`${base}milestones`}>לכל אבני הדרך ←</Link></div>
        <div className="card"><h2>קיצורי דרך</h2><div className="ov-links">
          <Link href={`/content?client=${id}`}>▦ גאנט תוכן</Link><Link href={`${base}knowledge`}>⌕ תיק מותג ומחקר</Link><Link href={`${base}assets`}>◧ בנק נכסים</Link>
          {fin ? <Link href={`${base}billing`}>₪ תשלומים</Link> : <Link href={`${base}contacts`}>☎ אנשי קשר</Link>}<Link href={`/talk?client=${id}`}>✦ משימה לסוכנים</Link><Link href={`/calendar`}>▣ פגישות ביומן</Link></div></div>
      </div></div>}
    {tab === 'reports' && <><ReportsPanel clientId={id} data={await rpc<any>('office_client_reports', { p_client: id }).catch(() => ({}))} /><div style={{ marginTop: 16 }}><ClientSources clientId={id} current={c.profile?.sources ?? {}} /></div></>}
    {tab === 'docs' && <DocsPanel clientId={id} docs={await rpc<any[]>('office_client_documents', { p_client: id }).catch(() => [])} />}
    {tab === 'milestones' && <Milestones clientId={id} items={milestones} engagements={engagements} />}
    {tab === 'billing' && fin && <div className="grid g2">
      <div className="card"><h2>הסדרי תשלום</h2>{plans.length ? plans.map((b: any) => <div key={b.id} style={{ marginBottom: 14 }}>
        <div className="row"><b className="sp">{b.title} · {KIND_HE[b.kind]}</b><span className={`badge ${b.status === 'active' ? 'ok' : 'muted'}`}>{b.status === 'active' ? 'פעיל' : b.status === 'paused' ? 'מושהה' : 'הסתיים'}</span></div>
        <div className="small">{fmtMoney(b.amount)}{b.kind === 'retainer' ? ` לחודש · יום ${b.payment_day} בחודש` : b.installments > 1 ? ` · ${b.installments} תשלומים` : ''} · {VAT_MODE_HE[b.vat_mode]}</div>
        <div className="small muted">{(b.services ?? []).map(serviceLabel).join(' · ')}{b.contact_name ? ` · איש קשר: ${b.contact_name}` : ''}</div>
        {b.status === 'active' && <div className="row" style={{ marginTop: 6 }}><ActionButton className="btn sm" action="update_billing_plan" payload={{ id: b.id, version: b.version, status: 'paused' }} confirm="להשהות? תשלומים עתידיים שלא שולמו יבוטלו">השהה</ActionButton>
          <ActionButton className="btn sm ghost" action="update_billing_plan" payload={{ id: b.id, version: b.version, status: 'ended' }} confirm="לסיים את ההסדר? תשלומים עתידיים שלא שולמו יבוטלו">סיים</ActionButton></div>}
      </div>) : <Empty>אין הסדר תשלום ללקוח.</Empty>}
        <h3 style={{ marginTop: 16 }}>תשלומים</h3>
        <Table head={['מועד', 'סכום', 'סטטוס', 'שולם']} rows={pays.map((x: any) => [fmtDate(x.due_date), fmtMoney(x.amount_gross ?? x.amount), PAY_STATUS_HE[x.effective_status] ?? x.effective_status, x.paid_at ? `${fmtDate(x.paid_at)} · ${fmtMoney(x.paid_amount)}` : '—'])} empty="אין תשלומים" />
        <Link className="btn sm" href={`/payments?f=all&client=${id}`}>לניהול התשלומים</Link></div>
      <div className="card"><h2>הסדר תשלום חדש</h2><OnboardForm clientId={id} terms={terms.map((t: any) => ({ id: t.id, name: `${t.name}${t.vat_rate != null ? ` · מע״מ ${t.vat_rate}%` : ''}` }))} /></div></div>}
    {tab === 'services' && <div className="grid g2">
      <div className="card"><h2>התקשרויות</h2>{engagements.length ? engagements.map((e: any) => <div key={e.id} style={{ marginBottom: 12 }}>
        <div className="row"><Badge s={e.status} /><span className="sp">הקמה {fmtMoney(e.setup_fee)} · חודשי {fmtMoney(e.monthly_fee)} · מדיה (נפרד) {fmtMoney(e.media_budget)}</span>
          {e.status === 'pending_start' && m.role === 'owner' && <ActionButton className="btn y sm" action="activate_engagement" payload={{ engagement_id: e.id }} confirm="תנאי ההתחלה התקיימו?">הפעל התקשרות</ActionButton>}</div>
        <div className="small muted">תנאי התחלה: {(e.start_conditions ?? []).join(' · ')} {(!e.rollover_policy || !e.partial_month_policy) && '· כללי גלגול/חודש חלקי: טרם נקבעו (להחלטתך)'}</div>
        {(e.accepted_snapshot?.content?.services ?? []).length > 0 && <div className="chips" style={{ margin: '8px 0' }}>{(e.accepted_snapshot.content.services as string[]).map((k) => <span key={k} className="badge c">{serviceLabel(k)}</span>)}</div>}
        <Table head={['שירות', 'יחידה', 'כמות לתקופה', 'סבבי תיקון']} rows={ents.filter((x: any) => x.engagement_id === e.id).map((x: any) => [x.title, x.unit, x.quantity_per_period, x.revision_rounds])} empty="לא הוגדרו שירותים" />
        {m.role === 'owner' && <details><summary className="small">הוסף/עדכן שירות</summary><ActionForm action="add_entitlement" extra={{ engagement_id: e.id }} fields={[{ name: 'service_key', label: 'מפתח', required: true, ltr: true }, { name: 'title', label: 'שם', required: true },
          { name: 'unit', label: 'יחידה', type: 'select', options: [['post', 'פוסט'], ['video', 'סרטון'], ['article', 'כתבה'], ['story', 'סטורי'], ['month', 'חודש'], ['page', 'עמוד']], required: true }, { name: 'quantity', label: 'כמות לתקופה', type: 'number', required: true }]} /></details>}
        {e.status === 'active' && <ActionForm action="open_service_period" extra={{ engagement_id: e.id }} submit="פתח תקופת שירות" fields={[{ name: 'month', label: 'חודש', type: 'date', required: true }]} />}
      </div>) : <Empty>אין התקשרות. שירותים נפתחים רק מהצעה מאושרת והתקשרות מתועדת.</Empty>}</div>
      <div className="card"><h2>מכסות התקופה {periods[0] ? `(${periods[0].period_start})` : ''}</h2>
        <Table head={['שירות', 'התחייבות', 'מוקצה', 'בתהליך', 'נמסר', 'יתרה']} rows={quota.map((q: any) => [q.title, q.committed, q.allocated, q.in_progress, q.delivered, <b key="a">{q.available}</b>])} empty="אין תקופה פתוחה" />
        <p className="small muted">{quota[0]?.rule}</p></div></div>}
    {tab === 'projects' && <div className="grid g2"><Table head={['שם', 'סוג', 'אתר']} rows={projects.map((p: any) => [p.name, p.kind, p.site_url ?? '—'])} empty="אין פרויקטים" />
      <div className="card"><h2>פרויקט / מותג חדש</h2><ActionForm action="create_project" extra={{ client_id: id }} fields={[{ name: 'name', label: 'שם', required: true },
        { name: 'kind', label: 'סוג', type: 'select', options: [['project', 'פרויקט'], ['brand', 'מותג'], ['real_estate_project', 'פרויקט נדל״ן'], ['campaign', 'קמפיין']] }, { name: 'site_url', label: 'אתר', ltr: true },
        { name: 'details', label: 'פרטים (JSON: קהל, מסרים, עובדות מאומתות)', type: 'textarea', json: true, ltr: true }]} /></div></div>}
    {tab === 'contacts' && <div className="grid g2"><Table head={['שם', 'תפקיד', 'טלפון', 'אומת', '']} rows={contacts.map((x: any) => [x.name, x.role_title ?? '—', <span key="p" dir="ltr">{x.phone_e164 ?? '—'}</span>, x.phone_verified ? '✓' : '—',
      !x.phone_verified && x.phone_e164 && ['owner', 'admin'].includes(m.role) ? <ActionButton key="v" className="btn sm" action="verify_contact_phone" payload={{ id: x.id }} confirm="אימתת שזה המספר הנכון של איש הקשר?">סמן כמאומת</ActionButton> : null])} empty="אין אנשי קשר" />
      <div className="card"><h2>איש קשר</h2><ActionForm action="create_contact" extra={{ client_id: id }} fields={[{ name: 'name', label: 'שם', required: true }, { name: 'role_title', label: 'תפקיד' },
        { name: 'phone_e164', label: 'טלפון (בינלאומי)', ltr: true, hint: '‎+972501234567' }, { name: 'email', label: 'אימייל', type: 'email', ltr: true }, { name: 'approval_role', label: 'תפקיד אישור' }, { name: 'whatsapp_opt_in', label: 'הסכים לקבל הודעות WhatsApp', type: 'checkbox' }]} /></div></div>}
    {tab === 'assets' && <>
      <AssetBank client={c} assets={assets} addForm={['owner', 'admin', 'manager'].includes(m.role) ? <SamplesForm clientId={id} /> : null} />
      <details className="card" style={{ marginTop: 16 }}><summary><b>כל הנכסים הרשומים ({assets.length}) · רישום נכס חדש</b></summary><div className="grid g2" style={{ marginTop: 12 }}>
        <Table head={['סוג', 'מזהה', 'סטטוס גישה']} rows={assets.map((x: any) => [x.kind, <span key="i" dir="ltr" style={{ wordBreak: 'break-all' }}>{x.identifier}</span>, x.access_status])} empty="אין נכסים רשומים" />
        <div><p className="small muted">רישום אינו מעניק הרשאת עריכה. החיבור נבדק בנפרד במסך החיבורים.</p>
        <ActionForm action="create_asset" extra={{ client_id: id }} fields={[{ name: 'kind', label: 'סוג', type: 'select', required: true, options: [['website', 'אתר'], ['wordpress', 'WordPress'], ['meta_ad_account', 'חשבון Meta'], ['google_ads_account', 'חשבון Google Ads'], ['ga4', 'GA4'], ['gsc', 'Search Console'], ['gtm', 'GTM'], ['drive_folder', 'תיקיית Drive'], ['social_profile', 'פרופיל סושיאל'], ['social_sample', 'דוגמת תוכן (קישור לפוסט/רילס)']] },
          { name: 'identifier', label: 'כתובת / מזהה', required: true, ltr: true }, { name: 'project_id', label: 'פרויקט', type: 'select', options: projects.map((p: any) => [p.id, p.name]) }, { name: 'notes', label: 'הערות' }]} /></div></div></details></>}
    {tab === 'knowledge' && (() => {
      const running = tasks.filter((t: any) => /סריקת אתר|רשתות חברתיות|מחקר|תיק לקוח|ספריית/.test(t.title) && !['done', 'cancelled', 'failed'].includes(t.status));
      const pending = knowledge.filter((k: any) => k.approval_status === 'pending'); const canApprove = ['owner', 'admin'].includes(m.role);
      const actions = <>
        {running.length > 0 && <span className="badge cyan">המחקר רץ · {running.length} שלבים</span>}
        {canApprove && pending.length > 0 && <ActionButton className="btn y" action="approve_knowledge" payload={{ ids: pending.map((k: any) => k.id) }} confirm={`לאשר ${pending.length} פריטי ידע? מאושרים בלבד נכנסים להקשר של הסוכנים.`}>אשר את כל הידע ({pending.length})</ActionButton>}
        {!canApprove || !pending.length ? (knowledge.length > 0 && <span className="badge ok">הידע מאושר ✓</span>) : null}
      </>;
      return <>
        {c.profile?.dossier ? <BrandBook client={c} actions={actions} /> : <div className="bb-empty big"><b>עדיין אין תיק לקוח</b><p>הפעל מחקר לקוח מלא: סריקת האתר, הרשתות החברתיות, חיפוש ברשת ו-ChatGPT. התיק נבנה כאן אוטומטית.</p>{running.length > 0 && <span className="badge cyan">המחקר רץ עכשיו · {running.map((t: any) => t.title.split(' · ').pop()).join(' · ')}</span>}</div>}
        <details className="card" style={{ marginTop: 16 }} open={!c.profile?.dossier}><summary><b>{c.profile?.dossier ? 'הרצת מחקר מחדש' : 'הפעלת מחקר לקוח'}</b></summary>
          <ResearchPanel clientId={id} name={c.name} industry={c.industry} website={c.profile?.website ?? c.profile?.dossier_extra?.website} socials={c.profile?.socials} /></details>
        <details className="card" style={{ marginTop: 16 }}><summary><b>פריטי הידע שהסוכנים מקבלים ({knowledge.length}{pending.length ? ` · ${pending.length} ממתינים לאישור` : ''})</b></summary>
          <div className="grid g2" style={{ marginTop: 12 }}><div><Table head={['כותרת', 'סוג', 'סטטוס', '']} rows={knowledge.map((k: any) => [<details key="d"><summary><b>{k.title}</b></summary><pre className="out" style={{ whiteSpace: 'pre-wrap', maxHeight: 420, overflow: 'auto' }}>{k.body}</pre></details>, k.kind, <Badge key="b" s={k.approval_status} />,
            k.approval_status === 'pending' && canApprove ? <span key="a" className="row" style={{ gap: 6 }}><ActionButton className="btn sm y" action="approve_knowledge" payload={{ id: k.id }}>אשר</ActionButton><ActionButton className="btn sm ghost" action="approve_knowledge" payload={{ id: k.id, status: 'rejected' }}>דחה</ActionButton></span> : null])} empty="אין ידע ללקוח" />
            <p className="small muted">פריטים מאושרים בלבד נכנסים להקשר של הסוכנים.</p></div>
          <div><h3>פריט ידע ידני</h3><ActionForm action="add_knowledge" extra={{ client_id: id, scope: 'client' }} fields={[{ name: 'title', label: 'כותרת', required: true }, { name: 'kind', label: 'סוג', type: 'select', options: [['guideline', 'הנחיה'], ['decision', 'החלטה'], ['fact', 'עובדה'], ['brand', 'מותג'], ['source', 'מקור']] },
            { name: 'body', label: 'תוכן', type: 'textarea', required: true }, { name: 'source_url', label: 'מקור', ltr: true }, { name: 'valid_until', label: 'בתוקף עד', type: 'date' }]} /></div></div></details>
      </>;
    })()}
    {tab === 'work' && <div className="grid g2"><div className="card"><h2>משימות</h2><Table head={['משימה', 'מצב', 'עדכון']} rows={tasks.map((t: any) => [<Link key="l" href={`/tasks/${t.id}`}>{t.title}</Link>, <Badge key="b" s={t.status} />, <When key="w" d={t.updated_at} />])} /></div>
      <div className="card"><h2>תוצרים</h2><Table head={['תוצר', 'סוג', 'גרסה']} rows={arts.map((a: any) => [<Link key="l" href={`/studio/${a.id}`}>{a.title}</Link>, a.kind, a.current_version])} />
        <h2 style={{ marginTop: 16 }}>פריטי תוכן</h2><Table head={['נושא', 'מועד', 'הפקה']} rows={items.map((i: any) => [i.topic, fmtDateTime(i.due_at), <Badge key="b" s={i.production_status} />])} /></div></div>}
  </>;
}
