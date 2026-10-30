'use client';
import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
/** Detail pages opened from a list render inside this sheet (Next intercepting route). Direct links still open the full page. */
export function RouteSheet({ children, wide = true }: { children: React.ReactNode; wide?: boolean }) {
  const r = useRouter(); const path = usePathname(); const start = useRef(path);
  const close = useCallback(() => r.back(), [r]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && close(); document.addEventListener('keydown', k); document.documentElement.classList.add('sheet-open');
    return () => { document.removeEventListener('keydown', k); document.documentElement.classList.remove('sheet-open'); }; }, [close]);
  if (path !== start.current) return null; // navigated elsewhere from inside the sheet
  return <div className="sheet-scrim" onClick={close} role="presentation"><div className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
    <header><button className="sheet-x" onClick={close} aria-label="סגירה">✕</button><a className="btn sm ghost" href={path}>פתח כעמוד מלא ↗</a></header>
    <div className="sheet-b page-in-sheet">{children}</div></div></div>;
}
