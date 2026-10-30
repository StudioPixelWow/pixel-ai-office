'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { callRpc } from '@/components/client';
// Global search (Ctrl/⌘+K): clients, leads, proposals, meetings, LOUD guests and contacts.
const T: Record<string, [string, string]> = { client: ['◎', 'לקוח'], lead: ['↗', 'ליד'], proposal: ['❖', 'הצעה'], meeting: ['▣', 'פגישה'], loud: ['🎙', 'LOUD'], contact: ['☎', 'איש קשר'] };
const GO: [string, string, string][] = [['/', '◉', 'מרכז בקרה'], ['/approvals', '✓', 'לטיפולי'], ['/calendar', '▣', 'יומן'], ['/leads?new=1', '＋', 'ליד חדש'], ['/clients?new=1', '＋', 'לקוח חדש'], ['/talk', '✦', 'משימה לסוכנים'], ['/content', '▦', 'גאנט תוכן'], ['/loud', '🎙', 'אולפן LOUD'], ['/payments', '₪', 'תשלומים']];
export function SearchButton({ className = 'btn ghost top-search' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  return <><button type="button" className={className} onClick={() => setOpen(true)} aria-label="חיפוש"><span aria-hidden>⌕</span><span className="ts-l">חיפוש</span><kbd>⌘K</kbd></button>{open && <Palette onClose={() => setOpen(false)} />}</>;
}
function Palette({ onClose }: { onClose: () => void }) {
  const r = useRouter(); const [q, setQ] = useState(''); const [res, setRes] = useState<any[]>([]); const [i, setI] = useState(0); const [busy, setBusy] = useState(false); const t = useRef<any>(null); const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { inp.current?.focus(); const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  useEffect(() => { clearTimeout(t.current); if (q.trim().length < 2) { setRes([]); return; } setBusy(true);
    t.current = setTimeout(async () => { try { setRes(await callRpc('office_search', { p_q: q })); setI(0); } catch { setRes([]); } finally { setBusy(false); } }, 220); }, [q]);
  const items = q.trim().length < 2 ? GO.map(([href, icon, title]) => ({ href, title, icon, sub: 'מעבר מהיר' })) : res.map((x) => ({ ...x, icon: T[x.type]?.[0] ?? '•', sub: `${T[x.type]?.[1] ?? ''}${x.sub ? ` · ${x.sub}` : ''}` }));
  const go = (h: string) => { onClose(); r.push(h); };
  return <div className="pal-scrim" onClick={onClose}><div className="pal" role="dialog" aria-label="חיפוש" onClick={(e) => e.stopPropagation()}>
    <div className="pal-in"><span>⌕</span><input ref={inp} value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לקוח, ליד, הצעה, פגישה, איש קשר…"
      onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); } if (e.key === 'Enter' && items[i]) go(items[i].href); }} />{busy && <i className="pal-spin" />}</div>
    <ul className="pal-l">{items.map((x, j) => <li key={x.href + j}><button className={j === i ? 'on' : ''} onMouseEnter={() => setI(j)} onClick={() => go(x.href)}><b>{x.icon}</b><span>{x.title}<small>{x.sub}</small></span></button></li>)}
      {q.trim().length >= 2 && !busy && !items.length && <li className="pal-empty">לא נמצאו תוצאות ל״{q}״</li>}</ul>
    <div className="pal-f"><span>↑↓ ניווט</span><span>Enter פתיחה</span><span>Esc סגירה</span></div></div></div>;
}
