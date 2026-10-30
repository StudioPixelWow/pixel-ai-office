'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV: [string, string, string, string][] = [
  ['היום', '/', '◉', 'מרכז בקרה'], ['היום', '/approvals', '✓', 'לטיפולי'], ['היום', '/talk', '✦', 'תן משימה לסוכנים'],
  ['לקוחות וכסף', '/clients', '◎', 'לקוחות'], ['לקוחות וכסף', '/leads', '↗', 'לידים'], ['לקוחות וכסף', '/proposals', '❖', 'הצעות מחיר'], ['לקוחות וכסף', '/payments', '₪', 'תשלומים'],
  ['תוכן ועבודה', '/content', '▦', 'גאנט תוכן'], ['תוכן ועבודה', '/tasks', '☰', 'משימות'], ['תוכן ועבודה', '/studio', '✎', 'סטודיו קריאייטיב'],
  ['תוכן ועבודה', '/research', '⌕', 'מחקר ו-RTM'], ['תוכן ועבודה', '/planning', '◷', 'פרויקטים ויומן'], ['תוכן ועבודה', '/media', '◔', 'מדיה ומדידה'], ['תוכן ועבודה', '/conversations', '✉', 'שיחות'],
  ['המשרד הווירטואלי', '/office', '◐', 'המשרד בלייב'], ['המשרד הווירטואלי', '/agents', '☺', 'הסוכנים'], ['המשרד הווירטואלי', '/automations', '⟳', 'אוטומציות'],
  ['מערכת', '/knowledge', '▤', 'ידע וקבצים'], ['מערכת', '/connections', '⚡', 'חיבורים'], ['מערכת', '/usage', '$', 'עלויות'], ['מערכת', '/settings', '⚙', 'הגדרות'],
];
export function Nav({ waiting }: { waiting: number }) {
  const p = usePathname(); let sec = '';
  return <nav aria-label="ניווט ראשי">{NAV.map(([s, href, icon, label]) => {
    const head = s !== sec ? (sec = s, <div className="sec" key={'s' + s}>{s}</div>) : null;
    const on = href === '/' ? p === '/' : p.startsWith(href);
    return [head, <Link key={href} href={href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}><i className="ni" aria-hidden>{icon}</i>{label}
      {href === '/approvals' && waiting > 0 && <span className="count">{waiting}</span>}</Link>];
  })}</nav>;
}
