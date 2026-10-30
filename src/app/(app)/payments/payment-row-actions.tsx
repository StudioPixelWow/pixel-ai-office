'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction, Modal } from '@/components/client';
import { heError } from '@/lib/errors';
import { METHOD_HE } from '@/lib/services';

type P = { id: string; version: number; amount: number; amount_gross: number | null; status: string; client_name: string; link_url?: string | null; invoice_url?: string | null; invoice_number?: string | null; due_date: string; notes?: string | null };

/** Per-row controls for the office manager: mark paid, payment link (Grow), invoice (Green Invoice), notes, waive/cancel. */
export function PaymentRowActions({ p, grow, invoices }: { p: P; grow: boolean; invoices: boolean }) {
  const r = useRouter(); const [open, setOpen] = useState<null | 'paid' | 'edit' | 'invoice'>(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const due = p.amount_gross ?? p.amount; const done = ['paid', 'waived', 'cancelled'].includes(p.status);
  async function run(fn: () => Promise<any>) { setBusy(true); setMsg(''); try { await fn(); setOpen(null); r.refresh(); } catch (e) { setMsg(heError(e)); } finally { setBusy(false); } }
  async function post(url: string) { const x = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payment_id: p.id }) }); const j = await x.json(); if (!x.ok) throw new Error(j.error ?? 'error'); return j; }
  return <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
    {!done && <button className="btn sm y" onClick={() => setOpen('paid')}>סמן ששולם</button>}
    {!done && (p.link_url
      ? <button className="btn sm" onClick={() => navigator.clipboard.writeText(p.link_url!).then(() => setMsg('הקישור הועתק'))}>העתק קישור תשלום</button>
      : <button className="btn sm" disabled={!grow || busy || p.amount_gross == null} title={!grow ? 'Grow לא מחובר' : p.amount_gross == null ? 'אין סכום כולל מע״מ — חסרה תבנית מע״מ' : ''}
          onClick={() => run(() => post('/api/billing/grow-link'))}>צור קישור תשלום</button>)}
    {(p.status === 'paid' || p.status === 'partial') && (p.invoice_url
      ? <a className="btn sm" href={p.invoice_url} target="_blank" rel="noreferrer">חשבונית {p.invoice_number ?? ''}</a>
      : <button className="btn sm" disabled={!invoices} title={!invoices ? 'חשבונית ירוקה לא מחוברת' : ''} onClick={() => setOpen('invoice')}>הפק חשבונית</button>)}
    <button className="btn sm ghost" onClick={() => setOpen('edit')}>עריכה</button>
    {msg && <span className="small muted" role="status">{msg}</span>}

    <Modal open={open === 'paid'} onClose={() => setOpen(null)} label="סימון תשלום">
      <form className="f" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
        run(() => callAction('payment_mark_paid', { id: p.id, version: p.version, paid_amount: f.get('paid_amount'), paid_at: f.get('paid_at'), method: f.get('method'), notes: f.get('notes') })); }}>
        <h2>תשלום — {p.client_name}</h2>
        <label>סכום ששולם (₪)<input name="paid_amount" type="number" step="any" defaultValue={due} required /></label>
        <label>תאריך תשלום<input name="paid_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
        <label>אמצעי תשלום<select name="method" required defaultValue="transfer">{Object.entries(METHOD_HE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>הערה<input name="notes" /></label>
        <div className="row"><button className="btn y" disabled={busy}>שמור</button>{msg && <span className="small" style={{ color: 'var(--bad)' }}>{msg}</span>}</div></form></Modal>

    <Modal open={open === 'edit'} onClose={() => setOpen(null)} label="עריכת תשלום">
      <form className="f" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
        run(() => callAction('payment_update', { id: p.id, version: p.version, due_date: f.get('due_date'), notes: f.get('notes'), ...(f.get('status') ? { status: f.get('status') } : {}) })); }}>
        <h2>עריכת תשלום — {p.client_name}</h2>
        <label>מועד תשלום<input name="due_date" type="date" defaultValue={p.due_date} /></label>
        <label>הערות<textarea name="notes" defaultValue={p.notes ?? ''} /></label>
        <label>שינוי סטטוס<select name="status" defaultValue=""><option value="">ללא שינוי</option><option value="scheduled">החזר למתוכנן</option><option value="waived">ויתור על התשלום</option><option value="cancelled">ביטול</option></select></label>
        <div className="row"><button className="btn y" disabled={busy}>שמור</button>{msg && <span className="small" style={{ color: 'var(--bad)' }}>{msg}</span>}</div></form></Modal>

    <Modal open={open === 'invoice'} onClose={() => setOpen(null)} label="הפקת חשבונית">
      <h2>הפקת חשבונית מס/קבלה</h2>
      <p>ללקוח <b>{p.client_name}</b> על סך <b>₪{due}</b>, דרך חשבונית ירוקה.</p>
      <p className="small muted">חשבונית היא מסמך חשבונאי רשמי שלא ניתן למחוק — רק לבטל בחשבונית זיכוי. ודא שהפרטים נכונים.</p>
      <div className="row"><button className="btn y" disabled={busy} onClick={() => run(() => post('/api/billing/invoice'))}>{busy ? 'מפיק…' : 'אשר והפק'}</button>
        <button className="btn ghost" onClick={() => setOpen(null)}>ביטול</button>{msg && <span className="small" style={{ color: 'var(--bad)' }}>{msg}</span>}</div></Modal>
  </span>;
}
