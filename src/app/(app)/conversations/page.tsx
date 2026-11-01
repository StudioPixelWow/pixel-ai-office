import Link from 'next/link';
import { safeList, rpc } from '@/lib/api';
import { Hero, Table } from '@/components/ui';
import { fmtDateTime, ago } from '@/lib/format';
// Conversations per client: email threads (both mailboxes, in and out) + WhatsApp once Cloud API is connected.
export default async function Conversations() {
  const [mail, convs, msgs, contacts, clients] = await Promise.all([rpc<any[]>('office_email_conversations').catch(() => []), safeList('conversations'), safeList('messages', {}, 100), safeList('contacts', {}, 1000), safeList('clients')]);
  const ct = Object.fromEntries(contacts.map((c: any) => [c.id, c])); const cn = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
  return <>
    <Hero title={<>שיחות <span className="mark">עם לקוחות</span></>} sub="כל ההתכתבות במייל לפי לקוח: מה נכנס, מה ענינו ומה עוד מחכה לתשובה. וואטסאפ יצטרף לכאן כשיחובר WhatsApp Cloud." />
    <div className="cv-list">{(mail ?? []).map((c: any) => <div key={c.client_id} className="card cv">
      <div className="cv-h"><Link href={`/clients/${c.client_id}`}><b>{c.client}</b></Link><small>{ago(c.last_at)}</small><span className="sp" />
        {c.waiting > 0 && <span className="badge yellow">{c.waiting} מחכים לתשובה</span>}<span className="badge muted">📥 {c.inbound} · 📤 {c.outbound}</span></div>
      <ul className="cv-msgs">{(c.recent ?? []).map((x: any) => <li key={x.id} className={x.dir}><span className="cv-dir">{x.dir === 'out' ? '↩ אנחנו' : x.who}</span><span className="sp"><b>{x.subject || '(ללא נושא)'}</b>{x.summary ? <small>{x.summary}</small> : null}</span><small>{fmtDateTime(x.at)}</small></li>)}</ul>
      <Link className="btn sm ghost" href="/inbox">לדואר הנכנס</Link></div>)}
      {!(mail ?? []).length && <p className="muted">עוד אין התכתבויות משויכות ללקוחות. מיילים חדשים ששויכו ללקוח בעמוד "דואר נכנס" יופיעו כאן.</p>}</div>
    {convs.length > 0 && <><h2 style={{ marginTop: 20 }}>וואטסאפ</h2>
      <Table head={['איש קשר', 'לקוח', 'ערוץ', 'הודעה נכנסת אחרונה', 'טיפול אוטומטי']} rows={convs.map((c: any) => [ct[c.contact_id]?.name ?? '—', cn[c.client_id] ?? '—', c.channel, fmtDateTime(c.last_inbound_at), c.auto_paused ? 'מושהה (בטיפול אנושי)' : 'פעיל'])} />
      <Table head={['כיוון', 'תוכן', 'מתי']} rows={msgs.map((m: any) => [m.direction === 'in' ? 'נכנסת' : 'יוצאת', m.body, fmtDateTime(m.occurred_at)])} /></>}
  </>;
}
