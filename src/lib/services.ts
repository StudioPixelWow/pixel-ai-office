// Pixel service catalog: used by client onboarding, billing plans and proposal content.
// Proposal blocks are the default copy for each service; the owner can edit the generated proposal before approving.
export type ServiceKind = 'retainer' | 'one_time';
export type Service = { key: string; label: string; kind: ServiceKind; tag: string; title: string; bullets: string[] };

export const SERVICES: Service[] = [
  { key: 'strategy', label: 'אסטרטגיה ותכנון', kind: 'retainer', tag: 'STRATEGY', title: 'אסטרטגיה ותכנון',
    bullets: ['אפיון קהלי היעד, הבידול והמסרים', 'תוכנית עבודה ולוח תוכן חודשי', 'פגישת עבודה חודשית והגדרת יעדים'] },
  { key: 'social', label: 'ניהול סושיאל', kind: 'retainer', tag: 'SOCIAL MEDIA', title: 'ניהול סושיאל',
    bullets: ['ניהול שוטף של עמודי הפייסבוק והאינסטגרם', 'פוסטים, סטוריז ורילס לפי לוח התוכן', 'עיצוב גרפי וכתיבת תוכן מקצועי', 'ניטור תגובות ושמירה על נוכחות פעילה'] },
  { key: 'campaigns', label: 'ניהול קמפיינים', kind: 'retainer', tag: 'PERFORMANCE', title: 'ניהול קמפיינים',
    bullets: ['הקמה וניהול קמפיינים ב-Meta ובגוגל', 'קריאייטיבים ומודעות לכל קמפיין', 'אופטימיזציה שוטפת להורדת העלות לפנייה', 'מעקב לידים ופניות מכל ערוץ'] },
  { key: 'seo', label: 'SEO — קידום אורגני', kind: 'retainer', tag: 'SEARCH', title: 'קידום אורגני (SEO)',
    bullets: ['SEO טכני ותוכן', 'מאמרים מקצועיים בתחום', 'ניהול ועדכון פרופיל Google Business', 'מעקב מיקומים חודשי'] },
  { key: 'geo', label: 'GEO / AEO — מנועי AI', kind: 'retainer', tag: 'SEARCH & AI', title: 'נראות במנועי AI (GEO · AEO)',
    bullets: ['נראות והמלצה במנועי בינה מלאכותית', 'תוכן מובנה שמנועים מצטטים', 'בדיקת נראות תקופתית ב-ChatGPT, Gemini ו-Google AI'] },
  { key: 'website_care', label: 'ניהול ותחזוקת אתר', kind: 'retainer', tag: 'WEBSITE', title: 'ניהול ותחזוקת אתר',
    bullets: ['עדכוני תוכן, תוספים ואבטחה', 'גיבויים וניטור זמינות', 'שיפורי מהירות וחוויית משתמש', 'אופטימיזציה להשארת פרטים'] },
  { key: 'analytics', label: 'מדידה ודיווח', kind: 'retainer', tag: 'ANALYTICS', title: 'מדידה ודיווח',
    bullets: ['הגדרת GA4, Search Console ומעקב המרות', 'דוח חודשי מסכם על כל הערוצים', 'ניתוח תוצאות והמלצות לחודש הבא', 'שקיפות מלאה על התקציב והביצועים'] },
  { key: 'reputation', label: 'ניהול מוניטין', kind: 'retainer', tag: 'REPUTATION', title: 'ניהול מוניטין',
    bullets: ['ניטור אזכורים וביקורות', 'מענה מקצועי לביקורות', 'חיזוק נוכחות חיובית ברשת'] },
  { key: 'graphics', label: 'שירותי גרפיקה', kind: 'retainer', tag: 'DESIGN', title: 'שירותי גרפיקה',
    bullets: ['עיצוב גרפי שוטף לפי צורך', 'מודעות, הזמנות, באנרים וחומרים לדפוס', 'התאמה לשפת המותג בכל תוצר'] },
  { key: 'branding', label: 'מיתוג', kind: 'one_time', tag: 'BRANDING', title: 'מיתוג',
    bullets: ['אפיון מותג, ערכים ובידול', 'לוגו ושפה גרפית', 'פלטת צבעים, טיפוגרפיה וחוברת מותג'] },
  { key: 'website', label: 'בניית אתר', kind: 'one_time', tag: 'WEBSITE', title: 'בניית אתר',
    bullets: ['אפיון, מבנה ועיצוב UX/UI', 'פיתוח רספונסיבי בעברית מלאה', 'SEO בסיסי, מהירות ונגישות', 'חיבור טפסים, מדידה והדרכה'] },
  { key: 'landing', label: 'דף נחיתה', kind: 'one_time', tag: 'LANDING', title: 'דף נחיתה',
    bullets: ['קופי ועיצוב ממוקדי המרה', 'טופס לידים ומדידה', 'התאמה מלאה למובייל'] },
  { key: 'production', label: 'הפקת צילום / וידאו', kind: 'one_time', tag: 'PRODUCTION', title: 'הפקת צילום ווידאו',
    bullets: ['יום צילום מתוכנן', 'צילומי סטילס ווידאו לרילס, לאתר ולקמפיינים', 'עריכה ומסירה בפורמטים לכל ערוץ'] },
  { key: 'campaign_setup', label: 'הקמת קמפיין', kind: 'one_time', tag: 'PERFORMANCE', title: 'הקמת קמפיין',
    bullets: ['מחקר קהלים ומילות מפתח', 'מבנה קמפיינים ומודעות', 'הגדרת מדידה והמרות'] },
];
export const SERVICE_BY_KEY = Object.fromEntries(SERVICES.map((s) => [s.key, s]));
export const serviceLabel = (k: string) => SERVICE_BY_KEY[k]?.label ?? k;
export const VAT_MODE_HE: Record<string, string> = { plus_vat: 'לפני מע״מ (יתווסף מע״מ)', included: 'כולל מע״מ', exempt: 'פטור ממע״מ' };
export const KIND_HE: Record<string, string> = { retainer: 'ריטיינר חודשי', one_time: 'פרויקט חד-פעמי' };
export const PAY_STATUS_HE: Record<string, string> = { scheduled: 'מתוכנן', due_soon: 'בשבוע הקרוב', overdue: 'באיחור', link_created: 'נשלח קישור', partial: 'שולם חלקית', paid: 'שולם', waived: 'ויתור', cancelled: 'בוטל' };
export const METHOD_HE: Record<string, string> = { credit: 'אשראי', bit: 'ביט', transfer: 'העברה בנקאית', check: 'צ׳ק', cash: 'מזומן', other: 'אחר' };
