'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV: [string, string, string][] = [
  ['ניהול', '/', 'תמונת מצב'], ['ניהול', '/office', 'המשרד הווירטואלי'], ['ניהול', '/talk', 'דבר עם המשרד'], ['ניהול', '/approvals', 'מרכז אישורים'],
  ['ניהול', '/agents', 'הסוכנים וסטודיו סוכנים'], ['ניהול', '/automations', 'אוטומציות'],
  ['עסק', '/clients', 'לקוחות, מותגים ופרויקטים'], ['עסק', '/leads', 'לידים ומכירות'], ['עסק', '/proposals', 'הצעות והתקשרויות'], ['עסק', '/payments', 'מעקב תשלומים'],
  ['עבודה', '/tasks', 'משימות ותהליכים'], ['עבודה', '/planning', 'גאנט, פרויקטים ויומן'], ['עבודה', '/studio', 'סטודיו קריאייטיב ווידאו'],
  ['עבודה', '/research', 'מחקר, RTM וטרנדים'], ['עבודה', '/media', 'מדיה ומדידה'], ['עבודה', '/conversations', 'שיחות'],
  ['מערכת', '/knowledge', 'קבצים, נכסים וידע'], ['מערכת', '/connections', 'חיבורים ותקינות'], ['מערכת', '/usage', 'שימוש, עלויות ופעילות'], ['מערכת', '/settings', 'הגדרות'],
];
export function Nav({ waiting }: { waiting: number }) {
  const p = usePathname(); let sec = '';
  return <nav aria-label="ניווט ראשי">{NAV.map(([s, href, label]) => {
    const head = s !== sec ? (sec = s, <div className="sec" key={'s' + s}>{s}</div>) : null;
    const on = href === '/' ? p === '/' : p.startsWith(href);
    return [head, <Link key={href} href={href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>{label}
      {href === '/approvals' && waiting > 0 && <span className="count">{waiting}</span>}</Link>];
  })}</nav>;
}
