const TZ = 'Asia/Jerusalem';
export const fmtDate = (d?: string | null) => d ? new Intl.DateTimeFormat('he-IL', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—';
export const fmtDateTime = (d?: string | null) => d ? new Intl.DateTimeFormat('he-IL', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '—';
export const fmtMoney = (n?: number | string | null, cur = 'ILS') => n === null || n === undefined || n === '' ? '—' : new Intl.NumberFormat('he-IL', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(Number(n));
export const fmtUsd = (n?: number | string | null) => n === null || n === undefined ? '—' : '$' + Number(n).toFixed(2);
export const ago = (d?: string | null) => {
  if (!d) return '—'; const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'עכשיו'; if (s < 3600) return `לפני ${Math.round(s / 60)} ד׳`; if (s < 86400) return `לפני ${Math.round(s / 3600)} ש׳`; return fmtDate(d);
};
export const STATUS_HE: Record<string, string> = {
  queued: 'בתור', running: 'עובד', waiting_input: 'ממתין לחומר', waiting_approval: 'ממתין לאישור', waiting_connection: 'ממתין לחיבור',
  waiting_local: 'ממתין לחיבור מקומי', retrying: 'מנסה שוב', failed: 'נכשל', done: 'הושלם', cancelled: 'בוטל', uncertain: 'לא ודאי', available: 'זמין',
  draft: 'טיוטה', pending_approval: 'ממתין לאישור', needs_review: 'דורש בדיקה', saved_later: 'נשמר לאחר כך', sending: 'בתהליך שליחה', accepted: 'התקבל אצל הספק',
  delivered: 'נמסר', read: 'נקרא',
  not_connected: 'לא מחובר', pending_setup: 'ממתין להגדרה', access_verified: 'גישה אומתה', action_tested: 'פעולה נבדקה', missing_permissions: 'חסרות הרשאות',
  expired: 'פג תוקף', no_balance: 'אין יתרה', rate_limited: 'מגבלת קצב', requires_user: 'דורש משתמש', not_implemented: 'טרם מומש',
  new: 'חדש', scoping: 'באפיון', proposal_drafting: 'הצעה בהכנה', ready_to_send: 'מוכנה לשליחה', sent: 'נשלחה', negotiation: 'במשא ומתן', engaged: 'התקשרות מאושרת', lost: 'לא התקדמה', archived: 'ארכיון',
  in_review: 'בבדיקה', changes_requested: 'נדרשים תיקונים', approved: 'מאושר', superseded: 'הוחלף', planned: 'מתוכנן', in_production: 'בהפקה', blocked: 'חסום',
  onboarding: 'בהקמה', active: 'פעיל', paused: 'מושהה', ended: 'הסתיים', drafting: 'בהכנה', pending_owner: 'ממתין לאישורך', declined: 'נדחתה', pending_start: 'ממתין לתנאי התחלה',
  testing: 'בניסיון',
};
export const he = (s?: string | null) => (s ? STATUS_HE[s] ?? s : '—');
export const TONE: Record<string, string> = {
  running: 'cyan', retrying: 'cyan', queued: 'muted', done: 'ok', approved: 'ok', accepted: 'ok', delivered: 'ok', read: 'ok', action_tested: 'ok', access_verified: 'ok', active: 'ok', engaged: 'ok',
  waiting_approval: 'yellow', pending_approval: 'yellow', pending_owner: 'yellow', in_review: 'yellow', needs_review: 'warn', waiting_input: 'warn', waiting_connection: 'warn', waiting_local: 'warn',
  failed: 'bad', uncertain: 'bad', expired: 'bad', no_balance: 'bad', missing_permissions: 'bad', cancelled: 'muted', not_connected: 'muted', not_implemented: 'muted',
};
export const DEPT_HE: Record<string, string> = { pixel_digital: 'Pixel Digital', pixel_nadlan: 'Pixel Nadlan', pixel_rest: 'Pixel Rest', pixel_lawyer: 'Pixel Lawyer', bakoma: 'בקומה' };
