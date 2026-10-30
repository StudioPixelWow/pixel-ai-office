import Link from 'next/link';
import { ActionButton } from '@/components/client';
// Upsell opportunities: service gaps per active client (rules in office.opportunities).
export function Opportunities({ items, compact = false }: { items: any[]; compact?: boolean }) {
  if (!items.length) return compact ? null : <div className="cc-empty"><b>אין כרגע הזדמנויות פתוחות</b><p>כשללקוח יש שירות שמשלים את מה שהוא כבר קונה — זה יופיע כאן.</p></div>;
  return <ul className="op-list">{items.map((x) => <li key={x.client_id + x.service}>
    <div><b>{compact ? '' : `${x.client} · `}{x.label ?? x.service}</b><small>{x.reason}</small></div>
    <div className="op-act">
      <Link className="btn sm y" href={`/talk?client=${x.client_id}`}>הכן הצעת הרחבה</Link>
      <ActionButton className="btn sm ghost" action="upsell_dismiss" payload={{ client_id: x.client_id, service: x.service }}>לא עכשיו</ActionButton>
    </div></li>)}</ul>;
}
