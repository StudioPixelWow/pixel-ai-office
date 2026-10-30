import { safeList, me } from '@/lib/api';
import { Hero, Table } from '@/components/ui';
import { ActionForm } from '@/components/client';
import { AvatarToken } from './avatar-token';
import { AvatarSheetUpload } from './avatar-sheet';
import { ROSTER } from '@/agents/roster';
export default async function Settings() {
  const m = await me(); const [members, terms] = await Promise.all([safeList('memberships'), safeList('terms_templates')]);
  const org: any = m.org;
  return <>
    <Hero title={<>הגדרות</>} sub={`${org?.name} · אזור זמן ${org?.timezone} · מטבע ${org?.currency}`} />
    <div className="grid g2">
      <div className="card"><h2>משתמשים והרשאות</h2><Table head={['אימייל', 'תפקיד', 'פעיל']} rows={members.map((x: any) => [<span key="e" dir="ltr">{x.email}</span>, x.role, x.active ? 'כן' : 'לא'])} />
        {m.role === 'owner' && <ActionForm action="invite_member" submit="הוסף משתמש מורשה" fields={[{ name: 'email', label: 'אימייל', type: 'email', ltr: true, required: true },
          { name: 'role', label: 'תפקיד', type: 'select', required: true, options: [['admin', 'מנהל מערכת'], ['account_manager', 'מנהל לקוח'], ['employee', 'עובד'], ['viewer', 'צופה']] }]} />}
        <p className="small muted">מנהל מערכת ומנהל לקוח אינם מקבלים זכות אישור הודעות. אישור WhatsApp — Owner בלבד.</p></div>
      <div className="card"><h2>תבניות מס ותנאים</h2><Table head={['שם', 'מע״מ', 'כלול', 'תנאי תשלום']} rows={terms.map((t: any) => [t.name, t.vat_rate ?? 'לא הוגדר', t.prices_include_vat === null ? '—' : t.prices_include_vat ? 'כן' : 'לא', t.payment_terms ?? '—'])} empty="אין תבניות — המערכת לא מנחשת שיעורי מס או תנאים" />
        {m.role === 'owner' && <ActionForm action="set_terms_template" submit="שמור תבנית מאושרת" fields={[{ name: 'name', label: 'שם', required: true }, { name: 'currency', label: 'מטבע', defaultValue: 'ILS' },
          { name: 'vat_rate', label: 'שיעור מע״מ (%)', type: 'number', hint: 'הזן את השיעור התקף לפי החלטתך' }, { name: 'prices_include_vat', label: 'המחירים כוללים מע״מ', type: 'checkbox' },
          { name: 'payment_terms', label: 'תנאי תשלום', type: 'textarea' }, { name: 'validity_days', label: 'תוקף הצעה (ימים)', type: 'number' }]} />}</div>
      {m.role === 'owner' && <div className="card"><h2>מספרי בדיקה ל-WhatsApp</h2><p className="small muted">חשבון הבדיקה שולח רק לטבלת בדיקה, ורק למספרים שאישרת כאן במפורש.</p>
        <ActionForm action="set_test_numbers" reset={false} fields={[{ name: 'numbers', label: 'מספרים (JSON)', type: 'textarea', json: true, ltr: true, defaultValue: JSON.stringify(org?.settings?.test_numbers ?? ['+972500000001']) }]} /></div>}
      {m.role === 'owner' && <div className="card"><h2>יבוא דמויות סוכנים</h2><AvatarSheetUpload ids={[...ROSTER].sort((a, b) => a.number - b.number).map((a) => a.id)} /><AvatarToken /></div>}
    </div>
  </>;
}
