const MAP: [RegExp, string][] = [
  [/not_authenticated/, 'נדרשת התחברות'],
  [/no_membership|not_invited/, 'למשתמש הזה אין הרשאה למשרד'],
  [/owner_already_set/, 'כבר הוגדר Owner למשרד'],
  [/forbidden:([a-z_]+)/, 'אין לך הרשאה לפעולה הזו'],
  [/only_owner_can_approve_messages/, 'רק ה-Owner יכול לאשר שליחת הודעה'],
  [/snapshot_changed_reload/, 'הטיוטה השתנתה מאז שהוצגה — רענן ובדוק שוב לפני אישור'],
  [/not_pending:(\w+)/, 'הטיוטה אינה ממתינה לאישור'],
  [/price_not_set_by_owner/, 'טרם קבעת מחיר להצעה'],
  [/locked_price_change_rejected/, 'שינוי מחיר נעול נדחה — רק ה-Owner יכול לקבוע מחיר'],
  [/price_snapshot_differs_from_locked_price/, 'המחיר בגרסה שונה מהמחיר הנעול — יש ליצור גרסה חדשה'],
  [/approved_version_is_immutable/, 'גרסה מאושרת אינה ניתנת לשינוי — צור גרסה חדשה'],
  [/version_needs_update:(.*)/, 'הגרסה סומנה כזקוקה לעדכון: $1'],
  [/conflict:/, 'הרשומה עודכנה בינתיים על ידי מישהו אחר — רענן ונסה שוב'],
  [/bad_phone_format_e164/, 'מספר טלפון בפורמט בינלאומי בלבד, למשל ‎+972501234567'],
  [/engagement_not_active/, 'אין התקשרות פעילה'],
  [/provider_job_pending_check_status_first/, 'יש עבודה פתוחה אצל ספק — בדוק סטטוס לפני ניסיון חוזר (מניעת חיוב כפול)'],
  [/not_retryable_in_status/, 'לא ניתן לנסות שוב במצב הנוכחי'],
  [/agent_not_active/, 'הסוכן אינו פעיל'],
  [/unknown_action/, 'פעולה לא מוכרת'],
];
export function heError(e: unknown): string {
  const msg = typeof e === 'string' ? e : (e as { message?: string })?.message ?? String(e);
  for (const [re, he] of MAP) { const m = msg.match(re); if (m) return he.replace('$1', m[1] ?? ''); }
  return msg;
}
