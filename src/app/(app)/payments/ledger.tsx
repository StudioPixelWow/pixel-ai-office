'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { callAction, Modal } from '@/components/client';
import { heError } from '@/lib/errors';
import { fmtMoney, fmtDate } from '@/lib/format';

type Doc = { id: string; type: number; number: string | null; url: string | null; at?: string };
type Row = { id: string; version: number; client_id: string; client_name: string; plan_title: string; plan_kind: string; period_month: string | null; due_date: string;
  amount: number; vat_mode: string; amount_gross: number | null; vat: number; status: string; effective_status: string; is_overdue: boolean; paid_amount: number | null;
  paid_at: string | null; method: string | null; reference: string | null; link_url: string | null; notes: string | null; contact_email: string | null; docs: Doc[] };
type Data = { month: string; vat_rate: number | null; kpis: any; rows: Row[]; docs: any[]; docs_month: number; clients: { id: string; name: string }[] };

const DOC: Record<number, string> = { 305: 'חשבונית מס', 320: 'חשבונית מס קבלה', 400: 'קבלה', 330: 'זיכוי' };
const METHODS: [string, string, string][] = [['transfer', 'העברה בנקאית', 'מספר אסמכתא'], ['credit', 'כרטיס אשראי', '4 ספרות אחרונות'], ['bit', 'ביט / פייבוקס', 'מספר עסקה'], ['check', 'צ׳ק', 'מספר צ׳ק'], ['cash', 'מזומן', '']];
const METHOD_HE = Object.fromEntries(METHODS.map(([k, l]) => [k, l])) as Record<string, string>;
const ST: Record<string, [string, string]> = { overdue: ['באיחור', 'bad'], due_soon: ['השבוע', 'warn'], scheduled: ['ממתין', 'muted'], link_created: ['נשלח קישור', 'cyan'], partial: ['שולם חלקית', 'warn'], paid: ['שולם', 'ok'], waived: ['ויתור', 'muted'], cancelled: ['בוטל', 'muted'] };
const TABS: [string, string][] = [['open', 'לגבייה'], ['month', 'כל החודש'], ['paid', 'שולמו'], ['docs', 'מסמכים']];
const monthHe = (m: string) => new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date(`${m}-01T12:00:00`));
const shift = (m: string, n: number) => { const d = new Date(`${m}-01T12:00:00`); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7); };
const total = (r: Row) => Number(r.amount_gross ?? r.amount);
const open = (r: Row) => ['scheduled', 'link_created', 'partial'].includes(r.status);

export function Ledger({ d, isOwner, invoices, invEnv, grow }: { d: Data; isOwner: boolean; invoices: boolean; invEnv: string; grow: boolean }) {
  const r = useRouter(); const [tab, setTab] = useState('open'); const [client, setClient] = useState(''); const [q, setQ] = useState('');
  const [pay, setPay] = useState<Row | null>(null); const [doc, setDoc] = useState<{ row: Row; type: number } | null>(null); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const k = d.kpis ?? {};
  const rows = useMemo(() => d.rows.filter((x) => (!client || x.client_id === client) && (!q || x.client_name.includes(q))
    && (tab === 'open' ? open(x) : tab === 'paid' ? !!x.paid_at && x.paid_at.slice(0, 7) === d.month : tab === 'month' ? x.due_date.slice(0, 7) === d.month : true)), [d, tab, client, q]);
  const sumT = rows.reduce((a, x) => a + total(x), 0); const sumN = rows.reduce((a, x) => a + Number(x.amount), 0);
  const go = (m: string) => r.push(`/payments?m=${m}`);
  async function issue(row: Row, type: number) {
    setBusy(true); setMsg('');
    try { const x = await fetch('/api/billing/document', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payment_id: row.id, type }) });
      const j = await x.json(); if (!x.ok) throw new Error(j.error ?? 'error'); setMsg(`${j.label} ${j.number ?? ''} הופקה ✓`); setDoc(null); r.refresh(); }
    catch (e) { setMsg(heError(e)); } finally { setBusy(false); }
  }
  function csv() {
    const head = ['לקוח', 'הסדר', 'תקופה', 'מועד', 'לפני מע״מ', 'מע״מ', 'סה״כ', 'סטטוס', 'שולם', 'תאריך תשלום', 'אמצעי', 'אסמכתא', 'מסמכים'];
    const lines = d.rows.map((x) => [x.client_name, x.plan_title, x.period_month?.slice(0, 7) ?? '', x.due_date, x.amount, x.vat, total(x), (ST[x.effective_status] ?? [x.status])[0], x.paid_amount ?? '', x.paid_at ?? '', METHOD_HE[x.method ?? ''] ?? '', x.reference ?? '', x.docs.map((z) => `${DOC[z.type]} ${z.number ?? ''}`).join(' | ')]);
    const s = '﻿' + [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'text/csv;charset=utf-8' })); a.download = `הנהלת-חשבונות-${d.month}.csv`; a.click();
  }
  const docBtns = (x: Row) => {
    const hasInv = x.docs.some((z) => z.type === 305 || z.type === 320); const hasRec = x.docs.some((z) => z.type === 400 || z.type === 320); const paid = !!x.paid_at && ['paid', 'partial'].includes(x.status);
    const opts: number[] = []; if (!hasInv && !['waived', 'cancelled'].includes(x.status)) opts.push(paid ? 320 : 305); if (paid && !hasRec && hasInv) opts.push(400); if (paid && !hasInv) opts.push(305);
    return opts;
  };
  return <div className="acc">
    <div className="acc-head card">
      <div className="acc-title"><small>הנהלת חשבונות וגבייה</small><h1>{monthHe(d.month)}</h1></div>
      <div className="acc-nav"><button className="btn sm ghost" onClick={() => go(shift(d.month, -1))} aria-label="חודש קודם">→</button>
        <button className="btn sm ghost" onClick={() => go(new Date().toISOString().slice(0, 7))}>החודש</button>
        <button className="btn sm ghost" onClick={() => go(shift(d.month, 1))} aria-label="חודש הבא">←</button></div>
      <div className="acc-tools"><button className="btn sm" onClick={csv}>ייצוא לרואה החשבון</button>
        <span className={`badge ${invoices ? 'ok' : 'muted'}`}>חשבונית ירוקה {invoices ? (invEnv === 'sandbox' ? '· בדיקה' : '✓') : '—'}</span><span className={`badge ${grow ? 'ok' : 'muted'}`}>Grow {grow ? '✓' : '—'}</span></div>
    </div>

    {d.vat_rate == null && <div className="card acc-vat"><div><b>לא נקבע שיעור מע״מ</b><small>בלי זה אי אפשר לחשב סכומים כוללים, לשלוח קישורי תשלום ולהפיק חשבוניות נכונות. שיעור המע״מ בישראל ב-2026: 18%.</small></div>
      {isOwner ? <button className="btn y" disabled={busy} onClick={async () => { setBusy(true); try { const x = await callAction('vat_set_default', { rate: 18 }); setMsg(x.note); r.refresh(); } catch (e) { setMsg(heError(e)); } finally { setBusy(false); } }}>קבע 18% והחל על כל התשלומים</button>
        : <small>רק הבעלים יכול לקבוע</small>}</div>}

    <div className="acc-kpis">
      <div><small>לגבייה החודש</small><b>{fmtMoney(k.expected_gross)}</b><span>{fmtMoney(k.expected_net)} לפני מע״מ</span></div>
      <div className="ok"><small>נגבה החודש</small><b>{fmtMoney(k.collected)}</b><span>{k.collected_count ?? 0} תשלומים</span></div>
      <div><small>פתוח לגבייה</small><b>{fmtMoney(k.open_gross)}</b><span>כולל חודשים קודמים</span></div>
      <button className={`${k.overdue_count ? 'bad' : ''}`} onClick={() => setTab('open')}><small>באיחור</small><b>{k.overdue_count ?? 0}</b><span>{fmtMoney(k.overdue_sum)}</span></button>
      <div><small>מע״מ החודש</small><b>{fmtMoney(k.vat_month)}</b><span>{d.docs_month} מסמכים הופקו</span></div>
    </div>

    <div className="acc-bar"><div className="tabs" style={{ margin: 0 }}>{TABS.map(([key, l]) => <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>{l}</button>)}</div>
      <span className="sp" /><select value={client} onChange={(e) => setClient(e.target.value)} aria-label="לקוח"><option value="">כל הלקוחות</option>{d.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input placeholder="חיפוש לקוח" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    {msg && <p className="small acc-msg" role="status">{msg}</p>}

    {tab === 'docs' ? <div className="acc-table card"><table className="t"><thead><tr><th>תאריך</th><th>מסמך</th><th>מספר</th><th>לקוח</th><th>סכום</th><th></th></tr></thead><tbody>
      {d.docs.filter((z) => !client || d.rows.find((x) => x.id === z.payment_id)?.client_id === client).map((z) => <tr key={z.id}><td>{fmtDate(z.at)}</td><td><span className="badge cyan">{DOC[z.type]}</span></td><td><b>{z.number ?? '—'}</b></td><td>{z.client}</td><td>{fmtMoney(z.amount)}</td>
        <td>{z.url && <a className="btn sm" href={z.url} target="_blank" rel="noreferrer">פתח</a>}</td></tr>)}
      {!d.docs.length && <tr><td colSpan={6} className="muted">לא הופקו מסמכים בחודש הזה</td></tr>}</tbody></table></div>

    : <div className="acc-table card"><table className="t"><thead><tr><th>מועד</th><th>לקוח</th><th>לפני מע״מ</th><th>מע״מ</th><th>סה״כ</th><th>סטטוס</th><th>תשלום</th><th>מסמכים</th><th></th></tr></thead><tbody>
      {rows.map((x) => { const [sl, st] = ST[x.effective_status] ?? [x.status, 'muted']; const opts = docBtns(x);
        return <tr key={x.id} className={x.is_overdue ? 'late' : ''}>
          <td data-l="מועד"><b>{fmtDate(x.due_date)}</b></td>
          <td data-l="לקוח"><Link href={`/clients/${x.client_id}?tab=billing`}><b>{x.client_name}</b></Link><small>{x.plan_title}{x.period_month ? ` · ${x.period_month.slice(0, 7)}` : ''}</small></td>
          <td data-l="לפני מע״מ">{fmtMoney(x.vat_mode === 'included' ? Number(x.amount) - Number(x.vat) : x.amount)}</td>
          <td data-l="מע״מ" className="muted">{x.vat_mode === 'exempt' ? 'פטור' : fmtMoney(x.vat)}</td>
          <td data-l="סה״כ"><b>{x.amount_gross == null && x.vat_mode === 'plus_vat' ? '—' : fmtMoney(total(x))}</b></td>
          <td data-l="סטטוס"><span className={`badge ${st}`}>{sl}</span></td>
          <td data-l="תשלום" className="small">{x.paid_at ? <>{fmtDate(x.paid_at)} · {METHOD_HE[x.method ?? ''] ?? '—'}{x.reference ? <><br /><span className="muted">אסמכתא {x.reference}</span></> : null}</> : '—'}</td>
          <td data-l="מסמכים">{x.docs.length ? <span className="acc-docs">{x.docs.map((z) => <a key={z.id} href={z.url ?? '#'} target="_blank" rel="noreferrer" className="badge cyan">{DOC[z.type]} {z.number ?? ''}</a>)}</span> : <span className="muted small">—</span>}</td>
          <td className="acc-act">
            {open(x) && <button className="btn sm y" onClick={() => setPay(x)}>רישום תשלום</button>}
            {invoices && opts.map((t) => <button key={t} className="btn sm" onClick={() => setDoc({ row: x, type: t })}>{DOC[t]}</button>)}
            {open(x) && grow && !x.link_url && <button className="btn sm ghost" disabled={busy} onClick={async () => { setBusy(true); try { const y = await fetch('/api/billing/grow-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payment_id: x.id }) }); const j = await y.json(); if (!y.ok) throw new Error(j.error); r.refresh(); } catch (e) { setMsg(heError(e)); } finally { setBusy(false); } }}>קישור תשלום</button>}
            {x.link_url && open(x) && <button className="btn sm ghost" onClick={() => navigator.clipboard.writeText(x.link_url!).then(() => setMsg('קישור התשלום הועתק'))}>העתק קישור</button>}
          </td></tr>; })}
      {!rows.length && <tr><td colSpan={9} className="muted">אין תשלומים בתצוגה הזו</td></tr>}</tbody>
      {rows.length > 0 && <tfoot><tr><td colSpan={2}><b>סה״כ ({rows.length})</b></td><td>{fmtMoney(sumN)}</td><td /><td><b>{fmtMoney(sumT)}</b></td><td colSpan={4} /></tr></tfoot>}</table></div>}

    <PayModal row={pay} onClose={() => setPay(null)} invoices={invoices} onDone={(m) => { setMsg(m); setPay(null); r.refresh(); }} />

    <Modal open={!!doc} onClose={() => setDoc(null)} label="הפקת מסמך">
      {doc && <div className="f"><h2>הפקת {DOC[doc.type]}</h2>
        <dl className="acc-prev"><dt>לקוח</dt><dd>{doc.row.client_name}</dd><dt>עבור</dt><dd>{doc.row.plan_title}{doc.row.period_month ? ` — ${doc.row.period_month.slice(0, 7)}` : ''}</dd>
          {doc.type !== 400 && <><dt>סכום</dt><dd>{fmtMoney(doc.row.amount)} {doc.row.vat_mode === 'plus_vat' ? `+ מע״מ = ${fmtMoney(total(doc.row))}` : doc.row.vat_mode === 'included' ? 'כולל מע״מ' : 'פטור ממע״מ'}</dd></>}
          {doc.type !== 305 && <><dt>תקבול</dt><dd>{fmtMoney(doc.row.paid_amount)} · {METHOD_HE[doc.row.method ?? ''] ?? ''} · {fmtDate(doc.row.paid_at)}{doc.row.reference ? ` · אסמכתא ${doc.row.reference}` : ''}</dd></>}
          <dt>נשלח אל</dt><dd>{doc.row.contact_email ?? 'אין מייל ללקוח — המסמך יישמר בחשבונית ירוקה בלבד'}</dd></dl>
        <p className="small muted">{invEnv === 'sandbox' ? 'סביבת בדיקה — המסמך לא נחשב רשמי.' : 'מסמך חשבונאי רשמי: אי אפשר למחוק אותו, רק לבטל בחשבונית זיכוי.'}</p>
        <div className="row"><button className="btn y" disabled={busy} onClick={() => issue(doc.row, doc.type)}>{busy ? 'מפיק…' : 'אשר והפק'}</button><button className="btn ghost" onClick={() => setDoc(null)}>ביטול</button></div></div>}
    </Modal>
  </div>;
}

function PayModal({ row, onClose, onDone, invoices }: { row: Row | null; onClose: () => void; onDone: (m: string) => void; invoices: boolean }) {
  const [method, setMethod] = useState('transfer'); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [then, setThen] = useState('');
  if (!row) return null;
  const hasInv = row.docs.some((z) => z.type === 305);
  const due = Number(row.amount_gross ?? row.amount) - Number(row.paid_amount ?? 0); const ref = METHODS.find((m) => m[0] === method)?.[2];
  async function save(f: FormData) {
    setBusy(true); setErr('');
    try {
      await callAction('payment_mark_paid', { id: row!.id, version: row!.version, paid_amount: f.get('paid_amount'), paid_at: f.get('paid_at'), method, reference: f.get('reference'), notes: f.get('notes') });
      let note = 'התשלום נרשם ✓';
      if (then) { const x = await fetch('/api/billing/document', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payment_id: row!.id, type: Number(then) }) });
        const j = await x.json(); note = x.ok ? `התשלום נרשם · ${j.label} ${j.number ?? ''} הופקה ✓` : `התשלום נרשם, אבל המסמך לא הופק: ${j.error}`; }
      onDone(note);
    } catch (e) { setErr(heError(e)); } finally { setBusy(false); }
  }
  return <Modal open onClose={onClose} label="רישום תשלום">
    <form className="f" onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}>
      <h2>רישום תשלום — {row.client_name}</h2>
      <fieldset className="acc-methods"><legend className="small muted">איך שולם?</legend>{METHODS.map(([k, l]) => <label key={k} className={method === k ? 'on' : ''}><input type="radio" name="m" checked={method === k} onChange={() => setMethod(k)} />{l}</label>)}</fieldset>
      <div className="grid g2"><label>סכום שהתקבל (₪)<input name="paid_amount" type="number" step="any" defaultValue={due} required /></label>
        <label>תאריך<input name="paid_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label></div>
      {ref && <label>{ref}<input name="reference" dir="ltr" maxLength={40} /></label>}
      <label>הערה<input name="notes" /></label>
      {invoices && <label>אחרי הרישום<select value={then} onChange={(e) => setThen(e.target.value)}><option value="">לא להפיק מסמך עכשיו</option>
        {hasInv ? <option value="400">להפיק קבלה (יש כבר חשבונית מס)</option> : <option value="320">להפיק חשבונית מס קבלה</option>}</select></label>}
      {then && <p className="small muted">המסמך יופק בחשבונית ירוקה מיד אחרי השמירה. זה מסמך רשמי שאי אפשר למחוק.</p>}
      <div className="row"><button className="btn y" disabled={busy}>{busy ? 'שומר…' : 'שמור'}</button><button type="button" className="btn ghost" onClick={onClose}>ביטול</button>{err && <span className="small" style={{ color: 'var(--bad)' }}>{err}</span>}</div>
    </form></Modal>;
}
