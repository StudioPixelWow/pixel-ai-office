import Link from 'next/link';
import { he, TONE, fmtDateTime } from '@/lib/format';
import type { ReactNode } from 'react';

export function Badge({ s, children }: { s?: string | null; children?: ReactNode }) {
  return <span className={`badge ${TONE[s ?? ''] ?? ''}`}><span className="dot" />{children ?? he(s)}</span>;
}
export function Stat({ n, label, href, tone }: { n: ReactNode; label: string; href?: string; tone?: string }) {
  const body = <><div className="n">{n}</div><div className="l">{label}</div></>;
  return <div className={`card ${tone ?? ''}`}>{href ? <Link className="stat" href={href}>{body}</Link> : <div className="stat">{body}</div>}</div>;
}
export function Empty({ children }: { children: ReactNode }) { return <div className="empty">{children}</div>; }
export function Hero({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return <div className="hero"><div className="row"><div className="sp"><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children}</div></div>;
}
export function Table({ head, rows, empty }: { head: ReactNode[]; rows: ReactNode[][]; empty?: ReactNode }) {
  if (!rows.length) return <Empty>{empty ?? 'אין נתונים עדיין'}</Empty>;
  return <div className="tablewrap"><table className="t"><thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>;
}
// Developer notes about each screen — hidden from the office UI (kept in code as documentation).
export function Contract(_: { source: string; actions: string; perms: string; empty: string }) { return null; }
function ContractDebug({ source, actions, perms, empty }: { source: string; actions: string; perms: string; empty: string }) {
  return <details className="small muted" style={{ marginTop: 18 }}><summary>חוזה המסך</summary>
    <dl className="kv" style={{ marginTop: 8 }}><dt>מקור הנתונים</dt><dd>{source}</dd><dt>פעולות</dt><dd>{actions}</dd><dt>הרשאות</dt><dd>{perms}</dd><dt>כשאין נתונים</dt><dd>{empty}</dd></dl></details>;
}
void ContractDebug;
export const When = ({ d }: { d?: string | null }) => <span className="muted small">{fmtDateTime(d)}</span>;
export function Tabs({ items, on }: { items: [string, string][]; on: string }) {
  return <div className="tabs">{items.map(([k, label]) => <Link key={k} href={k} className={on === k ? 'on' : ''}>{label}</Link>)}</div>;
}
