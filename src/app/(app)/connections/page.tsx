import { safeList, me } from '@/lib/api';
import { Hero, Table, Badge, When, Contract } from '@/components/ui';
import { ActionButton, ActionForm } from '@/components/client';
const CATALOG: [string, string, string, string][] = [
  ['wordpress', 'WordPress (REST + Application Password)', 'app_password', 'create_wp_draft'], ['meta_ads', 'Meta Ads', 'oauth', 'read_campaign_metrics'], ['google_ads', 'Google Ads', 'oauth', 'read_campaign_metrics'],
  ['google_calendar', 'Google Calendar', 'oauth', 'read_calendar'], ['outlook', 'Outlook Calendar', 'oauth', 'read_calendar'], ['ga4', 'GA4', 'oauth', 'read_analytics'], ['gsc', 'Search Console', 'oauth', 'read_gsc'],
  ['drive', 'Google Drive', 'oauth', 'read_files'], ['chatgpt_browser', 'ChatGPT בדפדפן (Browser-assisted)', 'browser_assisted', 'generate_image'], ['kling_web', 'Kling בדפדפן (Browser-assisted)', 'browser_assisted', 'generate_video'],
  ['linkedin', 'LinkedIn (טיוטות וביצוע אנושי בלבד)', 'browser_assisted', 'draft_outreach'],
];
export default async function Connections() {
  const m = await me(); const [conns, caps, checks, runners, clients] = await Promise.all([safeList('connections', {}, 200), safeList('connection_capabilities', {}, 1000), safeList('connection_checks', {}, 60), safeList('local_runners'), safeList('clients', { _active: true })]);
  const cn = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
  return <>
    <Hero title={<>חיבורים, <span className="mark">הרשאות ותקינות</span></>} sub="חיבור מסומן פעיל רק אחרי בדיקה אמיתית. שמירת כתובת או מפתח אינה הוכחת יכולת. ChatGPT בדפדפן ו-OpenAI API הם חיבורים נפרדים." />
    {conns.map((c: any) => <div key={c.id} className="card" style={{ marginBottom: 12 }}>
      <div className="row"><h3 className="sp">{c.label} <span className="small muted">({c.provider} · {c.access_method})</span></h3><Badge s={c.status} />
        {!c.disconnected_at && c.access_method !== 'builtin' && <ActionButton className="btn danger sm" action="disconnect_connection" payload={{ id: c.id }} confirm="לנתק? משימות תלויות יעברו להמתנה.">נתק</ActionButton>}</div>
      <div className="small muted">חשבון: <span dir="ltr">{c.account_identifier ?? '—'}</span> · היקף: {c.office_scope ? 'משרדי (מפורש)' : (c.allowed_client_ids ?? []).map((id: string) => cn[id]).join(', ') || 'לא שויך ללקוח'} · אומת: <When d={c.verified_at} />{c.last_error ? ` · ${c.last_error}` : ''}</div>
      <Table head={['יכולת', 'מומש', 'מצב', 'חשבון שאומת', 'אופן בדיקה', 'מתי']} rows={caps.filter((x: any) => x.connection_id === c.id).map((x: any) => [x.capability, x.implemented ? 'כן' : 'לא', <Badge key="b" s={x.status} />, <span key="a" dir="ltr" className="small">{x.verified_account ?? '—'}</span>, x.check_method ?? '—', <When key="w" d={x.verified_at} />])} /></div>)}
    {!conns.length && <div className="note warn">החיבורים המובנים (Claude, OpenAI, Kling, WhatsApp) נבדקים אוטומטית ע״י ה-Worker כל 10 דקות אחרי הפריסה.</div>}
    <div className="grid g2" style={{ marginTop: 16 }}>
      <div className="card"><h2>חיבור חדש</h2><ActionForm action="upsert_connection" fields={[
        { name: 'provider', label: 'שירות', type: 'select', required: true, options: CATALOG.map(([k, l]) => [k, l]) }, { name: 'label', label: 'שם תצוגה', required: true },
        { name: 'access_method', label: 'דרך גישה', type: 'select', required: true, options: [['oauth', 'OAuth'], ['api_key', 'מפתח API'], ['app_password', 'Application Password'], ['browser_assisted', 'Browser-assisted (ביצוע מסייע, לא אוטומציה מלאה)'], ['local_runner', 'Local Runner']] },
        { name: 'account_identifier', label: 'חשבון / אתר', ltr: true }, { name: 'secret_ref', label: 'שם משתנה הסוד בשרת (לא הסוד עצמו)', ltr: true, hint: 'למשל WP_BAKOMA_APP_PASSWORD — הסוד נשמר כ-Sensitive ב-Vercel' },
        { name: 'allowed_client_ids', label: 'לקוחות מורשים (מזהים, פסיקים)', list: true, ltr: true }, { name: 'capabilities', label: 'יכולות (JSON)', type: 'textarea', json: true, ltr: true, defaultValue: '[{"capability":"create_wp_draft","implemented":true,"check_method":"GET /wp-json/wp/v2/users/me"}]' }]} />
        <p className="small muted">חיבור חדש נכנס במצב ״ממתין להגדרה״ עד שבדיקת גישה אמיתית עוברת. חיבור לחשבון אחד אינו מתיר עבודה בחשבון אחר.</p></div>
      <div className="card"><h2>Local Runner (המחשב שלך)</h2><p className="small">נדרש לרינדור FFmpeg ולמסלולי דפדפן מקומי. חיבור יוצא מוצפן, pairing חד-פעמי, ניתוק בכל רגע. ה-Cookies נשארים אצלך.</p>
        <Table head={['שם', 'מצב', 'יכולות', 'heartbeat', '']} rows={runners.map((r: any) => [r.name, r.revoked_at ? 'בוטל' : r.paired_at ? 'מחובר' : 'ממתין ל-pairing', (r.capabilities ?? []).join(', '), <When key="w" d={r.last_heartbeat_at} />,
          !r.revoked_at && m.role === 'owner' ? <ActionButton key="x" className="btn danger sm" action="revoke_local_runner" payload={{ id: r.id }}>נתק</ActionButton> : null])} />
        {m.role === 'owner' && <ActionForm action="create_local_runner" submit="צור קוד pairing" fields={[{ name: 'name', label: 'שם המחשב', defaultValue: 'MacBook Pro' }]} />}
        <p className="small muted">הרצה: <code dir="ltr">npm run runner -- --pair CODE</code> בתיקיית הפרויקט (ראה RUNBOOK).</p></div></div>
    <div className="card" style={{ marginTop: 16 }}><h2>בדיקות אחרונות</h2><Table head={['חיבור', 'יכולת', 'תוצאה', 'פרטים', 'מתי']} rows={checks.map((c: any) => [conns.find((x: any) => x.id === c.connection_id)?.label ?? '—', c.capability, <Badge key="b" s={c.result} />, <span key="d" className="small">{c.details}</span>, <When key="w" d={c.checked_at} />])} /></div>
    <Contract source="connections, connection_capabilities, connection_checks, local_runners" actions="חיבור, ניתוק, pairing" perms="Owner/מנהל" empty="רשימת חיבורים מובנים בהמתנה לבדיקה" />
  </>;
}
