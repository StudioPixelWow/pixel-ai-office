// Client intake file ("תיק אפיון") — the questions, shared by the client's page and the office view.
export type IntakeQ = { k: string; label: string; type: 'text' | 'textarea' | 'chips' | 'chips1' | 'links' | 'files'; hint?: string; placeholder?: string; options?: string[] };
export type IntakeSection = { key: string; emoji: string; title: string; intro: string; services?: string[]; qs: IntakeQ[] };
export type IntakeFile = { id: string; section: string; path: string; name: string; size: number; mime: string; at?: string };

export const INTAKE_MAX_MB = 50;

export const INTAKE_SECTIONS: IntakeSection[] = [
  { key: 'business', emoji: '🏢', title: 'העסק שלכם', intro: 'נתחיל מהבסיס. ספרו לנו על העסק במילים שלכם, בלי לחשוב על ניסוחים.', qs: [
    { k: 'name', label: 'שם העסק כפי שתרצו שיופיע', type: 'text' },
    { k: 'about', label: 'במה העסק עוסק?', type: 'textarea', hint: 'תיאור חופשי, כאילו אתם מספרים לחבר' },
    { k: 'offers', label: 'השירותים או המוצרים המרכזיים', type: 'textarea', hint: 'ומה הכי חשוב לכם למכור' },
    { k: 'facts', label: 'כמה עובדות על העסק', type: 'textarea', placeholder: 'שנים בתחום, מספר עובדים, אזורי שירות, שעות פעילות…' },
    { k: 'links', label: 'האתר והרשתות החברתיות', type: 'links' },
  ] },
  { key: 'audience', emoji: '🎯', title: 'הלקוחות שלכם', intro: 'ככל שנכיר טוב יותר את הלקוחות שלכם, כך נדבר אליהם מדויק יותר.', qs: [
    { k: 'ideal', label: 'מי הלקוח האידיאלי שלכם?', type: 'textarea', placeholder: 'גיל, מקצוע, אזור, מצב משפחתי, מה מעסיק אותו…' },
    { k: 'pain', label: 'איזו בעיה אתם פותרים לו?', type: 'textarea' },
    { k: 'why', label: 'למה לקוחות בוחרים דווקא בכם?', type: 'textarea' },
    { k: 'objections', label: 'מה בדרך כלל עוצר לקוחות מלקנות?', type: 'textarea' },
    { k: 'testimonials', label: 'המלצות וביקורות של לקוחות', type: 'files', hint: 'צילומי מסך, מכתבי תודה, סרטונים' },
  ] },
  { key: 'market', emoji: '🧭', title: 'השוק והמתחרים', intro: 'מי עוד פועל בתחום, ומה מעורר בכם השראה.', qs: [
    { k: 'competitors', label: 'המתחרים העיקריים', type: 'links', hint: 'קישור לאתר או לעמוד שלהם' },
    { k: 'comp_notes', label: 'מה אתם אוהבים או לא אוהבים אצלם?', type: 'textarea' },
    { k: 'inspiration', label: 'מותגים שמעוררים בכם השראה', type: 'links', hint: 'גם מחוץ לתחום שלכם' },
  ] },
  { key: 'goals', emoji: '🚀', title: 'מטרות ויעדים', intro: 'לאן אנחנו רוצים להגיע יחד.', qs: [
    { k: 'main', label: 'מה הכי חשוב לכם עכשיו?', type: 'chips', options: ['יותר לידים ופניות', 'יותר מכירות', 'מודעות למותג', 'השקת מוצר או שירות', 'מיתוג מחדש', 'גיוס עובדים'] },
    { k: 'success', label: 'איך תדעו שהצלחנו?', type: 'textarea', hint: 'מספר פניות בחודש, מכירות, יעד שחשוב לכם' },
    { k: 'dates', label: 'תאריכים ועונות חשובים', type: 'textarea', placeholder: 'חגים, השקות, עונות חזקות וחלשות…' },
  ] },
  { key: 'brand', emoji: '🎨', title: 'המותג והשפה', intro: 'הלוגו, הצבעים והקול שלכם.', qs: [
    { k: 'logo', label: 'לוגו', type: 'files', hint: 'עדיף קובץ וקטורי (AI, SVG, PDF) או PNG עם רקע שקוף' },
    { k: 'brandbook', label: 'חוברת מותג, פונטים וצבעים', type: 'files', hint: 'כל מה שיש, גם אם זה חלקי' },
    { k: 'tone', label: 'איך אתם רוצים להישמע?', type: 'chips', options: ['מקצועי ואמין', 'חם ומשפחתי', 'צעיר ואנרגטי', 'יוקרתי ומוקפד', 'ישיר ותכליתי', 'עם הומור'] },
    { k: 'avoid', label: 'יש משהו שחשוב להימנע ממנו?', type: 'textarea', placeholder: 'מילים, נושאים, צבעים, סגנון…' },
  ] },
  { key: 'media', emoji: '📸', title: 'מדיה וחומרים', intro: 'תמונות וסרטונים אמיתיים עושים את כל ההבדל. העלו כמה שיותר.', qs: [
    { k: 'photos', label: 'תמונות של העסק, הצוות והמוצרים', type: 'files' },
    { k: 'videos', label: 'סרטונים', type: 'files', hint: `עד ${INTAKE_MAX_MB}MB לקובץ. לקבצים כבדים יותר אפשר להוסיף קישור למטה` },
    { k: 'drive', label: 'קישור לתיקייה (Google Drive, Dropbox, WeTransfer)', type: 'links' },
    { k: 'docs', label: 'מצגות, קטלוגים, מחירונים וכל חומר נוסף', type: 'files' },
  ] },
  { key: 'website', emoji: '💻', title: 'האתר', intro: 'כדי שהאתר יעבוד בשבילכם מהיום הראשון.', services: ['website', 'landing', 'website_care'], qs: [
    { k: 'site_goal', label: 'מה המטרה העיקרית של האתר?', type: 'textarea' },
    { k: 'pages', label: 'אילו עמודים צריכים להיות באתר?', type: 'textarea', placeholder: 'בית, אודות, שירותים, גלריה, צור קשר…' },
    { k: 'site_likes', label: 'אתרים שאתם אוהבים', type: 'links', hint: 'ומה אהבתם בהם — אפשר לכתוב בשאלה הבאה' },
    { k: 'content', label: 'מה מצב התוכן לאתר?', type: 'chips1', options: ['יש תוכן מוכן', 'חלק קיים', 'צריך לכתוב הכול'] },
    { k: 'domain', label: 'דומיין ואחסון', type: 'chips1', options: ['יש דומיין ואחסון', 'יש רק דומיין', 'אין עדיין'] },
  ] },
  { key: 'campaigns', emoji: '📈', title: 'קמפיינים ופרסום', intro: 'מה כבר ניסיתם, ומה הכי חשוב לקדם.', services: ['campaigns', 'campaign_setup'], qs: [
    { k: 'past', label: 'פרסמתם בעבר? איפה ומה היו התוצאות?', type: 'textarea' },
    { k: 'budget', label: 'תקציב מדיה חודשי משוער', type: 'chips1', options: ['עד ₪3,000', '₪3,000–7,000', '₪7,000–15,000', 'מעל ₪15,000'] },
    { k: 'promote', label: 'מה הכי חשוב לקדם קודם?', type: 'textarea' },
    { k: 'areas', label: 'באילו אזורים אתם רוצים להגיע ללקוחות?', type: 'textarea' },
    { k: 'lead_flow', label: 'מה קורה כשנכנסת פנייה?', type: 'textarea', hint: 'מי מטפל, תוך כמה זמן, ואיך סוגרים עסקה' },
  ] },
  { key: 'social', emoji: '📱', title: 'סושיאל ותוכן', intro: 'איפה אתם נמצאים, ומי מופיע בתוכן.', services: ['social', 'graphics', 'production'], qs: [
    { k: 'channels', label: 'באילו ערוצים אתם פעילים?', type: 'chips', options: ['פייסבוק', 'אינסטגרם', 'טיקטוק', 'לינקדאין', 'יוטיוב', 'וואטסאפ עסקי'] },
    { k: 'face', label: 'מי יכול/ה להצטלם ולהופיע בתוכן?', type: 'textarea' },
    { k: 'liked', label: 'פוסטים או עמודים שאהבתם', type: 'links' },
    { k: 'topics', label: 'נושאים שחשוב לכם לדבר עליהם', type: 'textarea' },
  ] },
  { key: 'seo', emoji: '🔎', title: 'קידום אורגני ו-AI', intro: 'מה הלקוחות שלכם מחפשים בגוגל ובצ׳אטים.', services: ['seo', 'geo'], qs: [
    { k: 'keywords', label: 'על אילו חיפושים הייתם רוצים להופיע?', type: 'textarea', placeholder: 'למשל: עורך דין תעבורה בחיפה' },
    { k: 'faq', label: 'השאלות שלקוחות שואלים אתכם הכי הרבה', type: 'textarea' },
    { k: 'priority', label: 'השירותים והאזורים הכי חשובים לכם', type: 'textarea' },
  ] },
  { key: 'branding', emoji: '✨', title: 'מיתוג', intro: 'הבסיס לשפה הגרפית החדשה שלכם.', services: ['branding'], qs: [
    { k: 'why_now', label: 'למה מיתוג (או מיתוג מחדש) דווקא עכשיו?', type: 'textarea' },
    { k: 'values', label: '3 מילים שמתארות את המותג', type: 'text' },
    { k: 'dont', label: 'מה אסור שיהיה במיתוג?', type: 'textarea' },
    { k: 'refs', label: 'דוגמאות שאתם אוהבים', type: 'files', hint: 'לוגואים, עיצובים, צבעים — כל השראה' },
  ] },
  { key: 'access', emoji: '🔑', title: 'נכסים דיגיטליים', intro: 'רק כדי לדעת מה קיים. את הגישות עצמן נתאם איתכם בנפרד.', qs: [
    { k: 'have', label: 'מה כבר קיים אצלכם?', type: 'chips', options: ['עמוד פייסבוק או אינסטגרם', 'חשבון מודעות במטא', 'חשבון גוגל אדס', 'Google Analytics', 'פרופיל עסק בגוגל', 'מערכת CRM'] },
    { k: 'access_note', label: 'הערות', type: 'textarea', hint: 'לא צריך לשלוח כאן סיסמאות' },
  ] },
  { key: 'final', emoji: '💬', title: 'לסיום', intro: 'כמעט סיימנו. עוד כמה מילים, ואנחנו מוכנים לשיחה.', qs: [
    { k: 'more', label: 'משהו נוסף שחשוב שנדע?', type: 'textarea' },
    { k: 'extra', label: 'קבצים נוספים', type: 'files' },
    { k: 'call_times', label: 'מתי נוח לכם לשיחת האפיון?', type: 'text', placeholder: 'ימים ושעות שנוחים לכם' },
  ] },
];

export const sectionsFor = (services: string[]) => INTAKE_SECTIONS.filter((s) => !s.services || s.services.some((x) => services.includes(x)));

const filled = (v: unknown) => Array.isArray(v) ? v.some((x) => String(x ?? '').trim()) : String(v ?? '').trim().length > 0;
export function sectionProgress(s: IntakeSection, data: Record<string, any>, files: IntakeFile[]) {
  const d = data?.[s.key] ?? {};
  const done = s.qs.filter((q) => q.type === 'files' ? files.some((f) => f.section === `${s.key}:${q.k}`) : filled(d[q.k])).length;
  return { done, total: s.qs.length };
}
export function intakeProgress(services: string[], data: Record<string, any>, files: IntakeFile[]) {
  const t = sectionsFor(services).map((s) => sectionProgress(s, data, files));
  const done = t.reduce((a, x) => a + x.done, 0), total = t.reduce((a, x) => a + x.total, 0);
  return total ? Math.round((done / total) * 100) : 0;
}
// Plain-text rendering (office view, AI summary, email).
export function intakeText(services: string[], data: Record<string, any>, files: IntakeFile[]) {
  return sectionsFor(services).map((s) => {
    const d = data?.[s.key] ?? {};
    const lines = s.qs.map((q) => {
      if (q.type === 'files') { const fs = files.filter((f) => f.section === `${s.key}:${q.k}`); return fs.length ? `${q.label}: ${fs.length} קבצים (${fs.map((f) => f.name).slice(0, 8).join(', ')})` : null; }
      const v = d[q.k]; if (!filled(v)) return null;
      return `${q.label}: ${Array.isArray(v) ? v.filter(Boolean).join(' · ') : String(v).trim()}`;
    }).filter(Boolean);
    return lines.length ? `## ${s.title}\n${lines.join('\n')}` : null;
  }).filter(Boolean).join('\n\n');
}
export const fmtSize = (b: number) => b >= 1048576 ? `${(b / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`;
