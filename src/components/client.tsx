'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { heError } from '@/lib/errors';

export async function callAction(action: string, payload: Record<string, unknown>) {
  const r = await fetch('/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, payload }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? 'error');
  return j.data;
}
export async function callRpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch('/api/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fn, args }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? 'error');
  return j.data;
}

/** A button that performs a real action. Shows the precise server reason on failure — never a fake success. */
export function ActionButton({ action, payload, children, className = 'btn', confirm, onDone, disabled, title }:
  { action: string; payload: Record<string, unknown>; children: ReactNode; className?: string; confirm?: string; onDone?: (d: any) => void; disabled?: boolean; title?: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  return <span className="row" style={{ display: 'inline-flex' }}>
    <button className={className} disabled={busy || disabled} title={title} onClick={async () => {
      if (confirm && !window.confirm(confirm)) return;
      setBusy(true); setMsg(null);
      try { const d = await callAction(action, payload); onDone?.(d); if (d?.note) setMsg(d.note); router.refresh(); }
      catch (e) { setMsg(heError(e)); } finally { setBusy(false); }
    }}>{busy ? '…' : children}</button>
    {msg && <span className="small muted" role="status">{msg}</span>}
  </span>;
}

export type Field = { name: string; label: string; type?: 'text' | 'number' | 'textarea' | 'select' | 'date' | 'datetime-local' | 'email' | 'tel' | 'checkbox' | 'time';
  options?: [string, string][]; required?: boolean; hint?: string; ltr?: boolean; defaultValue?: string | number | boolean; json?: boolean; list?: boolean };

/** Generic form bound to an office action. Values are coerced per field type. */
export function ActionForm({ action, fields, extra = {}, submit = 'שמירה', onDone, reset = true, redirectTo }:
  { action: string; fields: Field[]; extra?: Record<string, unknown>; submit?: string; onDone?: (d: any) => void; reset?: boolean; redirectTo?: (d: any) => string | null }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const p: Record<string, unknown> = { ...extra };
    for (const f of fields) {
      if (f.type === 'checkbox') { p[f.name] = fd.get(f.name) === 'on'; continue; }
      const v = String(fd.get(f.name) ?? '').trim(); if (v === '') continue;
      if (f.json) { try { p[f.name] = JSON.parse(v); } catch { setMsg({ ok: false, t: `שדה ${f.label}: JSON לא תקין` }); return; } }
      else if (f.list) p[f.name] = v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
      else if (f.type === 'number') p[f.name] = Number(v);
      else if (f.type === 'datetime-local') p[f.name] = new Date(v).toISOString();
      else p[f.name] = v;
    }
    setBusy(true); setMsg(null);
    try {
      const d = await callAction(action, p); setMsg({ ok: true, t: d?.note ?? (d?.duplicate ? 'כבר קיים — לא נוצרה כפילות' : 'נשמר') });
      if (reset) e.currentTarget?.reset?.(); onDone?.(d);
      const to = redirectTo?.(d); if (to) router.push(to); else router.refresh();
    } catch (err) { setMsg({ ok: false, t: heError(err) }); } finally { setBusy(false); }
  }
  return <form className="f" onSubmit={onSubmit}>
    {fields.map((f) => <label key={f.name}>{f.label}{f.required && ' *'}
      {f.type === 'textarea' ? <textarea name={f.name} required={f.required} defaultValue={f.defaultValue as string} dir={f.ltr ? 'ltr' : undefined} />
        : f.type === 'select' ? <select name={f.name} required={f.required} defaultValue={f.defaultValue as string}>{!f.required && <option value="">—</option>}{f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        : f.type === 'checkbox' ? <input type="checkbox" name={f.name} defaultChecked={!!f.defaultValue} style={{ width: 'auto' }} />
        : <input name={f.name} type={f.type ?? 'text'} required={f.required} defaultValue={f.defaultValue as string} dir={f.ltr ? 'ltr' : undefined} step={f.type === 'number' ? 'any' : undefined} />}
      {f.hint && <span className="hint">{f.hint}</span>}</label>)}
    <div className="row"><button className="btn y" disabled={busy}>{busy ? 'שומר…' : submit}</button>
      {msg && <span className={`small ${msg.ok ? '' : 'muted'}`} role="status" style={{ color: msg.ok ? 'var(--ok)' : 'var(--bad)' }}>{msg.t}</span>}</div>
  </form>;
}

/** Live updates: SSE with Last-Event-ID resume; refreshes server data when engine events arrive. */
export function LiveRefresh({ onEvent }: { onEvent?: (e: any) => void }) {
  const router = useRouter(); const last = useRef<number>(0); const t = useRef<any>(null); const [state, setState] = useState<'on' | 'off'>('off');
  useEffect(() => {
    let es: EventSource | null = null; let stop = false;
    const open = () => {
      es = new EventSource('/api/stream' + (last.current ? `?after=${last.current}` : ''));
      es.onopen = () => setState('on');
      es.onmessage = (m) => { try { const e = JSON.parse(m.data); last.current = Math.max(last.current, e.id); onEvent?.(e);
        clearTimeout(t.current); t.current = setTimeout(() => router.refresh(), 600); } catch {} };
      es.onerror = () => { setState('off'); es?.close(); if (!stop) setTimeout(open, 3000); };
    };
    open(); return () => { stop = true; es?.close(); };
  }, [router, onEvent]);
  return <span className="badge" title="עדכונים חיים מהמנוע, כולל השלמה אחרי ניתוק"><span className="dot" style={{ color: state === 'on' ? 'var(--ok)' : 'var(--muted)' }} />{state === 'on' ? 'חי' : 'מתחבר…'}</span>;
}

export function Modal({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); if (open) window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open, onClose]);
  if (!open) return null;
  return <div className="modal-back" onClick={onClose}><div className="modal" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>{children}</div></div>;
}
