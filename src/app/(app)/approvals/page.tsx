import Link from 'next/link';
import { safeList, me, today } from '@/lib/api';
import { Hero, Badge, Table, When, Contract, Empty } from '@/components/ui';
import { DraftCard } from './draft-card';
import { rpc } from '@/lib/api';
import { buildQueue, QueueList } from '@/components/today-queue';

export default async function Approvals({ searchParams }: { searchParams: Promise<{ client?: string; kind?: string }> }) {
  const sp = await searchParams; const m = await me();
  const f: any = { status: ['pending_approval', 'needs_review', 'saved_later', 'sending', 'uncertain', 'failed'] }; if (sp.client) f.client_id = sp.client; if (sp.kind) f.kind = sp.kind;
  const [drafts, gates, clients, contacts, conns] = await Promise.all([safeList('message_drafts', f, 100), safeList('task_runs', { status: 'waiting_approval' }, 100),
    safeList('clients', {}), safeList('contacts', {}, 1000), safeList('connections', {}, 50)]);
  const cn = Object.fromEntries(clients.map((c: any) => [c.id, c.name])); const ct = Object.fromEntries(contacts.map((c: any) => [c.id, c]));
  const sn = Object.fromEntries(conns.map((c: any) => [c.id, c]));
  const t = await today();
  const q = t ? buildQueue({ ...t, blocked: [] }, []) : [];
  return <>
    <Hero title={<>לטיפולי <span className="mark">היום</span></>} sub="כל הודעת WhatsApp נשלחת רק בלחיצה שלך על ״אשר ושלח״ להודעה המסוימת. אין ״אשר הכל״, ואין אישור קבוע." />
    <section className="cc-card cc-queue" style={{ marginBottom: 20 }}><header><h2>כל מה שמחכה לך ({q.length + drafts.length})</h2><span className="muted small">תשלומים, פוסטים, תוצרי סוכנים, הצעות ותיקי לקוח — במקום אחד</span></header><QueueList q={q} /></section>
    <form className="row" style={{ marginBottom: 14 }}><select name="client" defaultValue={sp.client ?? ''} style={{ width: 220 }}><option value="">כל הלקוחות</option>{clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select name="kind" defaultValue={sp.kind ?? ''} style={{ width: 200 }}><option value="">כל הסוגים</option>{['reply', 'followup', 'reminder', 'materials_request', 'idea', 'proposal', 'meeting_reminder'].map((k) => <option key={k} value={k}>{k}</option>)}</select>
      <button className="btn">סינון</button></form>
    <h2>הודעות ({drafts.length})</h2>
    {drafts.length ? <div className="grid g2">{drafts.map((d: any) => <DraftCard key={d.id} d={d} client={cn[d.client_id] ?? 'ללא לקוח'} contact={ct[d.contact_id]} sender={sn[d.sender_connection_id]} isOwner={m.role === 'owner'} />)}</div> : <Empty>אין הודעות שממתינות לאישור</Empty>}
    <h2 style={{ marginTop: 24 }}>תוצרים והחלטות שממתינים לך ({gates.length})</h2>
    <Table head={['פריט', 'לקוח', 'מאז']} rows={gates.map((t: any) => [<Link key="l" href={`/tasks/${t.id}`}>{t.title}</Link>, cn[t.client_id] ?? 'Pixel', <When key="w" d={t.updated_at} />])} empty="אין תוצרים שממתינים לאישור" />
    <Contract source="message_drafts + task_runs(waiting_approval)" actions="אשר ושלח (Owner בלבד, נבדק בשרת מול snapshot), בקש ניסוח אחר, שמור לאחר כך, בטל" perms="אישור שליחה: Owner מאומת בלבד — לא נחשף לסוכנים" empty="הודעה שאין ממתינים" />
  </>;
}
