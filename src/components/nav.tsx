'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SearchButton } from './search';

export const LOGO_WHITE = 'https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-white-500.webp';

const NAV: [string, string, string, string][] = [
  ['היום', '/', '◉', 'מרכז בקרה'], ['היום', '/week', '▤', 'מצב שבוע'], ['היום', '/approvals', '✓', 'לטיפולי'], ['היום', '/calendar', '▣', 'יומן'], ['היום', '/talk', '✦', 'תן משימה לסוכנים'],
  ['לקוחות וכסף', '/clients', '◎', 'לקוחות'], ['לקוחות וכסף', '/leads', '↗', 'לידים'], ['לקוחות וכסף', '/proposals', '❖', 'הצעות מחיר'], ['לקוחות וכסף', '/payments', '₪', 'הנהלת חשבונות'], ['לקוחות וכסף', '/forecast', '↟', 'תחזית הכנסות'],
  ['תוכן ועבודה', '/content', '▦', 'גאנט תוכן'], ['תוכן ועבודה', '/winners', '⭐', 'פוסטים מנצחים'], ['תוכן ועבודה', '/loud', '🎙', 'אולפן LOUD'], ['תוכן ועבודה', '/tasks', '☰', 'משימות'], ['תוכן ועבודה', '/studio', '✎', 'סטודיו קריאייטיב'],
  ['תוכן ועבודה', '/research', '⌕', 'מחקר ו-RTM'], ['תוכן ועבודה', '/planning', '◷', 'פרויקטים ויומן'], ['תוכן ועבודה', '/media', '◔', 'מדיה ומדידה'], ['תוכן ועבודה', '/conversations', '✉', 'שיחות'],
  ['המשרד הווירטואלי', '/office', '◐', 'המשרד בלייב'], ['המשרד הווירטואלי', '/room', '◎', 'חדר ישיבות'], ['המשרד הווירטואלי', '/agents', '☺', 'הסוכנים'], ['המשרד הווירטואלי', '/automations', '⟳', 'אוטומציות'],
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

/* Mobile: compact top bar (white logo + menu) that opens the sidebar as a drawer, plus a bottom tab bar for the daily essentials */
export function MobileBar({ waiting }: { waiting: number }) {
  const p = usePathname(); const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [p]);
  useEffect(() => { document.documentElement.classList.toggle('nav-open', open); }, [open]);
  const tabs: [string, string, string][] = [['/', '◉', 'בקרה'], ['/approvals', '✓', 'לטיפולי'], ['/talk', '✦', 'משימה'], ['/calendar', '▣', 'יומן'], ['/clients', '◎', 'לקוחות']];
  return <>
    <div className="mbar"><button className="mbar-btn" aria-label="תפריט" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '✕' : '☰'}</button>
      <img src={LOGO_WHITE} alt="Pixel Digital" /><SearchButton className="mbar-btn mbar-s" /><Link href="/approvals" className="mbar-q">לטיפולי{waiting ? <b>{waiting}</b> : ' ✓'}</Link></div>
    <div className="mscrim" onClick={() => setOpen(false)} />
    <nav className="mtabs" aria-label="ניווט מהיר">{tabs.map(([h, i, l]) => { const on = h === '/' ? p === '/' : p.startsWith(h);
      return <Link key={h} href={h} className={on ? 'on' : ''}><i>{i}</i><span>{l}</span>{h === '/approvals' && waiting > 0 && <b>{waiting}</b>}</Link>; })}</nav>
  </>;
}
