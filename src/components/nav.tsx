'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SearchButton } from './search';
import { Icon } from './icon';
import { Menu, X } from 'lucide-react';

export const LOGO_WHITE = 'https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-white-500.webp';

const NAV: [string, string, string, string][] = [
  ['היום', '/', 'home', 'מרכז בקרה'], ['היום', '/week', 'week', 'מצב שבוע'], ['היום', '/approvals', 'approvals', 'לטיפולי'], ['היום', '/inbox', 'inbox', 'דואר נכנס'], ['היום', '/calendar', 'calendar', 'יומן'], ['היום', '/talk', 'talk', 'תן משימה לסוכנים'],
  ['לקוחות וכסף', '/clients', 'clients', 'לקוחות'], ['לקוחות וכסף', '/leads', 'leads', 'לידים'], ['לקוחות וכסף', '/winback', 'winback', 'החזרת לקוחות עבר'], ['לקוחות וכסף', '/proposals', 'proposals', 'הצעות מחיר'], ['לקוחות וכסף', '/ads', 'ads', 'ביצועי פרסום'], ['לקוחות וכסף', '/payments', 'payments', 'הנהלת חשבונות'], ['לקוחות וכסף', '/forecast', 'forecast', 'תחזית הכנסות'],
  ['תוכן ועבודה', '/content', 'content', 'גאנט תוכן'], ['תוכן ועבודה', '/winners', 'winners', 'פוסטים מנצחים'], ['תוכן ועבודה', '/loud', 'loud', 'אולפן LOUD'], ['תוכן ועבודה', '/tasks', 'tasks', 'משימות'], ['תוכן ועבודה', '/studio', 'studio', 'סטודיו קריאייטיב'],
  ['תוכן ועבודה', '/research', 'research', 'מחקר ו-RTM'], ['תוכן ועבודה', '/planning', 'planning', 'פרויקטים ומשימות'], ['תוכן ועבודה', '/media', 'media', 'מדיה ומדידה'], ['תוכן ועבודה', '/conversations', 'conversations', 'שיחות'],
  ['המשרד הווירטואלי', '/office', 'office', 'המשרד בלייב'], ['המשרד הווירטואלי', '/room', 'room', 'חדר ישיבות'], ['המשרד הווירטואלי', '/agents', 'agents', 'הסוכנים'], ['המשרד הווירטואלי', '/automations', 'automations', 'אוטומציות'],
  ['מערכת', '/knowledge', 'knowledge', 'ידע וקבצים'], ['מערכת', '/connections', 'connections', 'חיבורים'], ['מערכת', '/usage', 'usage', 'עלויות'], ['מערכת', '/settings', 'settings', 'הגדרות'],
];
export function Nav({ waiting }: { waiting: number }) {
  const p = usePathname(); let sec = '';
  return <nav aria-label="ניווט ראשי">{NAV.map(([s, href, icon, label]) => {
    const head = s !== sec ? (sec = s, <div className="sec" key={'s' + s}>{s}</div>) : null;
    const on = href === '/' ? p === '/' : p.startsWith(href);
    return [head, <Link key={href} href={href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}><i className="ni" aria-hidden><Icon name={icon} /></i>{label}
      {href === '/approvals' && waiting > 0 && <span className="count">{waiting}</span>}</Link>];
  })}</nav>;
}

/* Mobile: compact top bar (white logo + menu) that opens the sidebar as a drawer, plus a bottom tab bar for the daily essentials */
export function MobileBar({ waiting }: { waiting: number }) {
  const p = usePathname(); const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [p]);
  useEffect(() => { document.documentElement.classList.toggle('nav-open', open); }, [open]);
  const tabs: [string, string, string][] = [['/', 'home', 'בקרה'], ['/approvals', 'approvals', 'לטיפולי'], ['/talk', 'talk', 'משימה'], ['/calendar', 'calendar', 'יומן'], ['/clients', 'clients', 'לקוחות']];
  return <>
    <div className="mbar"><button className="mbar-btn" aria-label="תפריט" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
      <img src={LOGO_WHITE} alt="Pixel Digital" /><SearchButton className="mbar-btn mbar-s" /><Link href="/approvals" className="mbar-q">לטיפולי{waiting ? <b>{waiting}</b> : ' ✓'}</Link></div>
    <div className="mscrim" onClick={() => setOpen(false)} />
    <nav className="mtabs" aria-label="ניווט מהיר">{tabs.map(([h, i, l]) => { const on = h === '/' ? p === '/' : p.startsWith(h);
      return <Link key={h} href={h} className={on ? 'on' : ''}><i><Icon name={i} size={21} /></i><span>{l}</span>{h === '/approvals' && waiting > 0 && <b>{waiting}</b>}</Link>; })}</nav>
  </>;
}
