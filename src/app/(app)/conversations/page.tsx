import { safeList } from '@/lib/api';
import { Hero, Table } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
export default async function Conversations() {
  const [convs, msgs, contacts, clients] = await Promise.all([safeList('conversations'), safeList('messages', {}, 100), safeList('contacts', {}, 1000), safeList('clients')]);
  const ct = Object.fromEntries(contacts.map((c: any) => [c.id, c])); const cn = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
  return <>
    <Hero title={<>שיחות</>} sub="תשובה נכנסת משויכת ללקוח/ליד, עוצרת פולואפ לא רלוונטי ופותחת טיוטת תשובה — היא אינה אישור לשינוי מחיר, חוזה או הרשאות." />
    <Table head={['איש קשר', 'לקוח', 'ערוץ', 'הודעה נכנסת אחרונה', 'טיפול אוטומטי']} rows={convs.map((c: any) => [ct[c.contact_id]?.name ?? '—', cn[c.client_id] ?? '—', c.channel, fmtDateTime(c.last_inbound_at), c.auto_paused ? 'מושהה (בטיפולך)' : 'פעיל'])} empty="אין שיחות. הן נוצרות מ-Webhook של WhatsApp Cloud API אחרי החיבור." />
    <h2 style={{ marginTop: 20 }}>הודעות אחרונות</h2><Table head={['כיוון', 'תוכן', 'מתי']} rows={msgs.map((m: any) => [m.direction === 'in' ? 'נכנסת' : 'יוצאת', m.body, fmtDateTime(m.occurred_at)])} />
  </>;
}
