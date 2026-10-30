import Link from 'next/link';
import { fmtMoney } from '@/lib/format';
const TZ = 'Asia/Jerusalem';
const dm = (d: string) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, day: 'numeric', month: 'numeric' }).format(new Date(d));
const ago = (d: string) => { const s = Math.max(0, (Date.now() - +new Date(d)) / 1000); return s < 60 ? 'עכשיו' : s < 3600 ? `לפני ${Math.round(s / 60)} דק׳` : s < 86400 ? `לפני ${Math.round(s / 3600)} שע׳` : `לפני ${Math.round(s / 86400)} ימים`; };
export type Q = { k: string; tone: string; icon: string; title: string; sub: string; href: string; cta: string };
// One actionable queue for the office manager, most urgent first (money → missed posts → approvals → knowledge → blockers → connections).
function groupMs(list: any[]) { const m = new Map<string, any>(); for (const x of list) { const g = m.get(x.client_id) ?? { client_id: x.client_id, client: x.client, items: [], overdue: false }; g.items.push(x); g.overdue ||= x.overdue; m.set(x.client_id, g); }
  return [...m.values()].sort((a, b) => Number(b.overdue) - Number(a.overdue)); }
export function buildQueue(t: any, brokenConns: any[]): Q[] {
  const money = t.money;
  const q: Q[] = [
    ...(money?.overdue ?? []).map((p: any) => ({ k: 'p' + p.id, tone: 'warn', icon: '₪', title: `תשלום באיחור · ${p.client}`, sub: `${fmtMoney(p.amount)} · היה אמור להיכנס ב-${dm(p.due)}`, href: '/payments?f=overdue', cta: 'לטיפול' })),
    ...(t.posts_missed ?? []).map((p: any) => ({ k: 'm' + p.id, tone: 'warn', icon: '!', title: `פוסט לא עלה · ${p.client}`, sub: `${p.topic} · ${dm(p.due_at)}`, href: `/content?client=${p.client_id}`, cta: 'לסמן / לפרסם' })),
    ...(t.posts_pending ?? []).map((x: any) => ({ k: 'c' + x.client_id + x.month, tone: 'y', icon: '✎', title: `${x.count} פוסטים לאישורך · ${x.client}`, sub: `גאנט תוכן ${x.month.split('-').reverse().join('/')} — אישור בלחיצה אחת`, href: `/content?client=${x.client_id}&m=${x.month}`, cta: 'לאשר את החודש' })),
    ...(t.task_approvals ?? []).map((x: any) => ({ k: 't' + x.id, tone: 'y', icon: '✓', title: x.title, sub: `סוכן מחכה להחלטה שלך · ${ago(x.at)}`, href: `/tasks/${x.id}`, cta: 'לבדוק ולאשר' })),
    ...(t.proposals_pending ?? []).map((x: any) => ({ k: 'pr' + x.id, tone: 'y', icon: '❖', title: `הצעת מחיר מוכנה · ${x.title}`, sub: 'מחכה לאישור שלך לפני שליחה ללקוח', href: `/proposals/${x.id}`, cta: 'לאשר ולשלוח' })),
    ...(t.knowledge_pending ?? []).map((x: any) => ({ k: 'k' + x.client_id, tone: 'c', icon: '◎', title: `תיק לקוח מוכן · ${x.client}`, sub: `${x.count} פריטי ידע — רק מאושרים נכנסים לסוכנים`, href: `/clients/${x.client_id}?tab=knowledge`, cta: 'לעבור ולאשר' })),
    ...groupMs(t.milestones_due ?? []).map((g: any) => ({ k: 'ms' + g.client_id, tone: g.overdue ? 'warn' : 'c', icon: '◆', title: `${g.items.length} אבני דרך ${g.overdue ? 'באיחור' : 'להיום / למחר'} · ${g.client}`,
      sub: g.items.slice(0, 2).map((x: any) => x.title).join(' · ') + (g.items.length > 2 ? '…' : ''), href: `/clients/${g.client_id}?tab=milestones`, cta: 'לעדכן' })),
    ...(t.blocked ?? []).slice(0, 4).map((x: any) => ({ k: 'b' + x.id, tone: 'muted', icon: '⏸', title: x.title, sub: x.blocker ?? 'תקוע', href: x.request_id ? `/room/${x.request_id}` : `/tasks/${x.id}`, cta: 'לפתוח' })),
    ...brokenConns.slice(0, 2).map((c: any) => ({ k: 'cn' + c.id, tone: 'muted', icon: '⚡', title: `חיבור דורש טיפול · ${c.label}`, sub: c.last_error ?? 'בדיקת חיבור נכשלה', href: '/connections', cta: 'לחיבורים' })),
  ];
  return q;
}
export function QueueList({ q }: { q: Q[] }) {
  return q.length ? <ul>{q.map((x) => <li key={x.k} className={`t-${x.tone}`}><i>{x.icon}</i><div><b>{x.title}</b><small>{x.sub}</small></div><Link className="btn sm" href={x.href}>{x.cta}</Link></li>)}</ul>
    : <div className="cc-empty"><b>אין כלום בתור ✓</b><p>כשסוכן יסיים תוצר, תשלום יאחר או פוסט יחכה לאישור — זה יופיע כאן.</p></div>;
}
