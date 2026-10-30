'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';
type It = { id: string; topic: string; due_at: string; status: string; client: string; version: number };
export function Gantt({ year, month, items, markers }: { year: number; month: number; items: It[]; markers: { date: string; title: string }[] }) {
  const r = useRouter(); const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); const [err, setErr] = useState('');
  const clients = Array.from(new Set(items.map((i) => i.client))).sort();
  const day = (iso: string) => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', day: 'numeric' }).format(new Date(iso)));
  async function move(it: It, d: number) {
    if (d < 1 || d > days) return; const old = new Date(it.due_at);
    const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }).format(old);
    const local = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T${hhmm}:00`;
    // interpret as Asia/Jerusalem wall time (DST-aware) using the offset of that date
    const probe = new Date(local + 'Z'); const tzOff = new Date(probe.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })).getTime() - new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
    const iso = new Date(probe.getTime() - tzOff).toISOString();
    try { await callAction('move_content_item', { id: it.id, due_at: iso, version: it.version }); r.refresh(); } catch (e) { setErr(heError(e)); }
  }
  return <>{err && <div className="note bad small">{err}</div>}
    <div className="gantt" style={{ ['--days' as any]: days }} role="grid" aria-label="גאנט תוכן חודשי">
      <div className="hd lbl">לקוח</div>{Array.from({ length: days }, (_, i) => { const dt = new Date(Date.UTC(year, month, i + 1)); const wk = dt.getUTCDay() === 5 || dt.getUTCDay() === 6;
        const mk = markers.find((m) => Number(m.date.slice(8, 10)) === i + 1); return <div key={i} className={`hd ${wk ? 'wk' : ''}`} title={mk?.title}>{i + 1}{mk ? '★' : ''}</div>; })}
      {(clients.length ? clients : ['—']).map((c) => [<div key={c + 'l'} className="lbl">{c}</div>,
        ...Array.from({ length: days }, (_, i) => <div key={c + i} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData('id'); const it = items.find((x) => x.id === id); if (it) move(it, i + 1); }}>
          {items.filter((x) => x.client === c && day(x.due_at) === i + 1).map((x) => <button key={x.id} draggable className={`item ${x.status}`} title={`${x.topic} — ${x.status}`}
            onDragStart={(e) => e.dataTransfer.setData('id', x.id)} onKeyDown={(e) => { if (e.key === 'ArrowLeft') move(x, i + 2); if (e.key === 'ArrowRight') move(x, i); }}>{x.topic}</button>)}</div>)])}
    </div></>;
}
