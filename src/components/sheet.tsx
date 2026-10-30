'use client';
import { useEffect, useState } from 'react';
/** Side sheet (desktop) / bottom sheet (mobile) — opens details and forms in place instead of navigating away. */
export function Sheet({ title, children, onClose }: { title?: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', k); document.documentElement.classList.add('sheet-open'); return () => { document.removeEventListener('keydown', k); document.documentElement.classList.remove('sheet-open'); }; }, [onClose]);
  return <div className="sheet-scrim" onClick={onClose} role="presentation"><div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
    <header><b>{title}</b><button className="sheet-x" onClick={onClose} aria-label="סגירה">✕</button></header><div className="sheet-b">{children}</div></div></div>;
}

/** A button that opens its content in a sheet — forms open in place instead of being stacked at the bottom of a page. */
export function SheetButton({ label, title, className = 'btn y', children }: { label: React.ReactNode; title: string; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>{open && <Sheet title={title} onClose={() => setOpen(false)}>{children}</Sheet>}</>;
}
