import Link from 'next/link';
import { safeList } from '@/lib/api';
import { Hero, Table, Contract } from '@/components/ui';
import { ActionForm } from '@/components/client';
export default async function Studio({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams; const [arts, clients] = await Promise.all([safeList('artifacts', kind ? { kind } : {}, 300), safeList('clients', { _active: true })]);
  const cn = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
  return <>
    <Hero title={<>סטודיו <span className="mark">קריאייטיב, עיצוב ווידאו</span></>} sub="כל תוצר עם גרסאות, קובץ מקור, ייצוא, בדיקות ואישור. גרסה מאושרת לא נדרסת." />
    <div className="tabs">{[['', 'הכל'], ['idea', 'רעיונות'], ['copy', 'קופי'], ['design', 'עיצוב'], ['script', 'תסריט'], ['storyboard', 'סטוריבורד'], ['video', 'וידאו'], ['article', 'כתבות'], ['proposal_doc', 'הצעות'], ['report', 'דוחות']].map(([k, l]) => <a key={k} href={k ? `?kind=${k}` : '?'} className={(kind ?? '') === k ? 'on' : ''}>{l}</a>)}</div>
    <div className="grid g2"><Table head={['תוצר', 'סוג', 'לקוח', 'גרסה']} rows={arts.map((a: any) => [<Link key="l" href={`/studio/${a.id}`}>{a.title}</Link>, a.kind, cn[a.client_id] ?? 'Pixel', a.current_version])} empty="אין תוצרים עדיין" />
      <div className="card"><h2>בקשת קריאייטיב</h2><ActionForm action="create_request" extra={{ mode: 'work', idempotency_key: `studio:${Date.now()}` }} redirectTo="/room/{request_id}" fields={[
        { name: 'client_id', label: 'לקוח', type: 'select', required: true, options: clients.map((c: any) => [c.id, c.name]) },
        { name: 'text', label: 'מה צריך?', type: 'textarea', required: true, defaultValue: 'תן לי שלושה כיווני קריאייטיב לפוסט השבוע' }]} /></div></div>
    <Contract source="artifacts + artifact_versions" actions="תצוגה, הורדת מקור וייצוא, השוואת גרסאות, בקשת תיקון לגרסה מסוימת, אישור" perms="לפי היקף לקוח; אישור — Owner" empty="אין תוצרים" />
  </>;
}
