import { safeList } from '@/lib/api';
import { Hero, Table, Badge } from '@/components/ui';
import { ActionButton, ActionForm } from '@/components/client';
import { fmtDateTime } from '@/lib/format';
export default async function Knowledge({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams; const [items, files, clients] = await Promise.all([safeList('knowledge_items', q ? { _search: q } : {}, 300), safeList('files', {}, 200), safeList('clients', { _active: true })]);
  const cn = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
  return <>
    <Hero title={<>קבצים, <span className="mark">נכסים ומאגר ידע</span></>} sub="ידע Pixel כללי, ידע מחלקה וידע פרטי של לקוח — מופרדים. סוכנים מקבלים רק ידע מאושר של הלקוח שלהם." />
    <form className="row" style={{ marginBottom: 12 }}><input name="q" defaultValue={q} placeholder="חיפוש בידע (מכבד הרשאות)" style={{ maxWidth: 360 }} /><button className="btn">חיפוש</button></form>
    <div className="grid g2">
      <Table head={['כותרת', 'היקף', 'לקוח', 'סוג', 'סטטוס', '']} rows={items.map((k: any) => [k.title, k.scope, cn[k.client_id] ?? '—', k.kind, <Badge key="b" s={k.approval_status} />,
        k.approval_status === 'pending' ? <ActionButton key="a" className="btn sm" action="approve_knowledge" payload={{ id: k.id }}>אשר</ActionButton> : null])} empty="אין פריטי ידע" />
      <div className="card"><h2>ידע Pixel / מחלקה</h2><ActionForm action="add_knowledge" fields={[{ name: 'scope', label: 'היקף', type: 'select', required: true, options: [['pixel', 'Pixel כללי'], ['department', 'מחלקה']] },
        { name: 'department', label: 'מחלקה', type: 'select', options: [['pixel_digital', 'Pixel Digital'], ['pixel_nadlan', 'Pixel Nadlan'], ['pixel_rest', 'Pixel Rest'], ['pixel_lawyer', 'Pixel Lawyer'], ['bakoma', 'בקומה']] },
        { name: 'kind', label: 'סוג', type: 'select', options: [['guideline', 'הנחיה'], ['brand', 'מותג'], ['decision', 'החלטה'], ['fact', 'עובדה']] }, { name: 'title', label: 'כותרת', required: true },
        { name: 'body', label: 'תוכן', type: 'textarea', required: true }, { name: 'source_url', label: 'מקור', ltr: true }]} /></div></div>
    <h2 style={{ marginTop: 20 }}>קבצים</h2><Table head={['קובץ', 'לקוח', 'סוג', 'מאושר לשימוש', 'נוצר']} rows={files.map((f: any) => [f.file_name, cn[f.client_id] ?? '—', f.mime, f.approved_for_use ? '✓' : 'לבדיקה', fmtDateTime(f.created_at)])} empty="אין קבצים רשומים. העלאה מקושרת תמיד לרשומה עם הרשאות." />
  </>;
}
