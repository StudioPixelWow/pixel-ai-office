'use client';
import { useState } from 'react';
import { callAction } from '@/components/client';

export const CARE_RULES: { key: string; icon: string; title: string; when: string; group: 'sales' | 'service' | 'relation' | 'internal' }[] = [
  { key: 'lead_ack', icon: '⚡', title: 'מענה מיידי לליד חדש', when: 'ליד נכנס ← טיוטת "קיבלנו, נחזור אליך תוך שעה"', group: 'sales' },
  { key: 'lead_sla', icon: '⏰', title: 'ליד בלי מענה 24 שעות', when: 'התראה אליך — בלי הודעה ללקוח', group: 'internal' },
  { key: 'proposal_followup', icon: '📨', title: 'פולואפ להצעת מחיר', when: '3 ימים ואז 7 ימים אחרי שליחה, כל עוד לא נחתמה', group: 'sales' },
  { key: 'payment_reminder', icon: '💳', title: 'תזכורת תשלום', when: '3 ימים לפני המועד + תזכורת עדינה 3 ימים אחרי, עם קישור לתשלום', group: 'service' },
  { key: 'welcome', icon: '🎉', title: 'ברוכים הבאים', when: 'כשנפתחת עסקה — עם אבני הדרך הקרובות', group: 'service' },
  { key: 'milestone_done', icon: '✅', title: 'עדכון על אבן דרך שהושלמה', when: '"סיימנו את X, השלב הבא Y"', group: 'service' },
  { key: 'content_nudge', icon: '📅', title: 'תוכן שמחכה לאישור הלקוח', when: 'מעל 48 שעות — פעם בשבוע לכל לקוח', group: 'service' },
  { key: 'monthly_report', icon: '📊', title: 'סיכום חודשי ללקוח', when: '1–3 בחודש: מה פורסם, מה הושלם ומה בחודש הבא', group: 'service' },
  { key: 'meeting_followup', icon: '🤝', title: 'תודה אחרי פגישה', when: 'אחרי פגישה עם לקוח/ליד + תזכורת אליך לשלוח סיכום', group: 'relation' },
  { key: 'holiday_greeting', icon: '🌟', title: 'ברכה לחגים', when: 'יומיים לפני חג מרכזי, לכל לקוח פעיל', group: 'relation' },
  { key: 'anniversary', icon: '🎂', title: 'שנה של עבודה משותפת', when: 'ביום השנה לתחילת העבודה', group: 'relation' },
  { key: 'nps', icon: '💬', title: 'בדיקת שביעות רצון 1–10', when: 'כל 90 יום לכל ריטיינר', group: 'relation' },
  { key: 'churn_alert', icon: '⚠️', title: 'לקוח בסיכון', when: 'תשלום באיחור 14+ יום או 30 יום בלי פעילות — התראה אליך', group: 'internal' },
];
const GROUPS: Record<string, string> = { sales: 'מכירות', service: 'שירות שוטף', relation: 'קשר ואהבה', internal: 'התראות פנימיות' };

export function CarePanel({ rules, stats, canEdit }: { rules: Record<string, boolean>; stats: Record<string, { n: number; last: string }>; canEdit: boolean }) {
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(CARE_RULES.map((r) => [r.key, rules[r.key] ?? true])));
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const flip = async (key: string) => {
    if (!canEdit) return; const v = !on[key]; setBusy(key); setErr(null); setOn((o) => ({ ...o, [key]: v }));
    try { await callAction('care_rule_set', { key, enabled: v }); } catch (e: any) { setOn((o) => ({ ...o, [key]: !v })); setErr(e.message); } finally { setBusy(null); }
  };
  const active = Object.values(on).filter(Boolean).length;
  return <section className="care">
    <div className="care-head">
      <div><h2>שירות WOW אוטומטי</h2><p>המערכת מזהה רגעים חשובים אצל לקוחות ולידים ומכינה טיוטה מוכנה. <b>שום הודעה לא יוצאת בלי האישור שלך</b> ב"לטיפולי".</p></div>
      <div className="care-count"><b>{active}</b><span>מתוך {CARE_RULES.length} פעילות</span></div>
    </div>
    {err && <div className="err small">{err}</div>}
    {(['sales', 'service', 'relation', 'internal'] as const).map((g) => <div key={g} className="care-group">
      <h3>{GROUPS[g]}</h3>
      <div className="care-grid">{CARE_RULES.filter((r) => r.group === g).map((r) => { const s = stats[r.key];
        return <button key={r.key} type="button" className={`care-card ${on[r.key] ? 'on' : ''}`} onClick={() => flip(r.key)} disabled={busy === r.key || !canEdit} aria-pressed={on[r.key]}>
          <span className="care-ic">{r.icon}</span>
          <span className="care-tx"><b>{r.title}</b><small>{r.when}</small>{s ? <em>{s.n} ב-30 הימים האחרונים</em> : <em>עוד לא הופעל</em>}</span>
          <span className={`care-sw ${on[r.key] ? 'on' : ''}`} aria-hidden><i /></span>
        </button>; })}</div>
    </div>)}
  </section>;
}
