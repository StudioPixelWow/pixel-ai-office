'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';
import { SERVICES, VAT_MODE_HE } from '@/lib/services';
import { DEPT_HE } from '@/lib/format';

/** New client: company, contact, services, billing (retainer / one-time), amount, VAT mode and payment day. */
export function OnboardForm({ terms, clientId }: { terms: { id: string; name: string }[]; clientId?: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<'retainer' | 'one_time'>('retainer');
  const [services, setServices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const toggle = (k: string) => setServices((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const shown = SERVICES.filter((s) => s.kind === kind);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? '').trim();
    if (!services.length) { setMsg({ ok: false, t: 'בחר לפחות שירות אחד' }); return; }
    const plan = { kind, services, title: v('title'), amount: Number(v('amount')), vat_mode: v('vat_mode'), terms_template_id: v('terms_template_id'),
      payment_day: kind === 'retainer' ? v('payment_day') : '', installments: kind === 'one_time' ? v('installments') || '1' : '1', start_date: v('start_date'), end_date: v('end_date'), notes: v('notes') };
    const payload = clientId ? { client_id: clientId, plan } : { name: v('name'), industry: v('industry'), department: v('department'),
      contact: { name: v('contact_name'), role_title: v('contact_role'), phone: v('contact_phone'), email: v('contact_email') }, plan };
    setBusy(true); setMsg(null);
    try { const d = await callAction(clientId ? 'add_billing_plan' : 'onboard_client', payload);
      setMsg({ ok: true, t: `נשמר · נוצרו ${d.payments_created} תשלומים במעקב` }); router.push(`/clients/${d.client_id}?tab=billing`); router.refresh(); }
    catch (err) { setMsg({ ok: false, t: heError(err) }); } finally { setBusy(false); }
  }
  return <form className="f" onSubmit={submit}>
    {!clientId && <>
      <label>שם החברה *<input name="name" required /></label>
      <div className="grid g2"><label>תחום<input name="industry" /></label>
        <label>מחלקה<select name="department" defaultValue="pixel_digital">{Object.entries(DEPT_HE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label></div>
      <h3>איש קשר</h3>
      <div className="grid g2"><label>שם *<input name="contact_name" required /></label><label>תפקיד<input name="contact_role" /></label>
        <label>טלפון<input name="contact_phone" type="tel" dir="ltr" placeholder="+9725XXXXXXXX" /></label><label>דוא״ל<input name="contact_email" type="email" dir="ltr" /></label></div>
    </>}
    <h3>סוג ההתקשרות</h3>
    <div className="row" role="radiogroup">
      {(['retainer', 'one_time'] as const).map((k) => <button type="button" key={k} className={`btn ${kind === k ? 'y' : ''}`} aria-pressed={kind === k} onClick={() => { setKind(k); setServices([]); }}>
        {k === 'retainer' ? 'ריטיינר חודשי' : 'פרויקט חד-פעמי'}</button>)}</div>
    <fieldset className="chips"><legend className="small muted">שירותים *</legend>
      {shown.map((s) => <label key={s.key} className={`chip ${services.includes(s.key) ? 'on' : ''}`}><input type="checkbox" checked={services.includes(s.key)} onChange={() => toggle(s.key)} />{s.label}</label>)}</fieldset>
    <label>כותרת ההסדר<input name="title" placeholder={kind === 'retainer' ? 'ריטיינר שיווק דיגיטלי' : 'בניית אתר תדמית'} /></label>
    <div className="grid g2">
      <label>{kind === 'retainer' ? 'סכום חודשי (₪) *' : 'סכום הפרויקט (₪) *'}<input name="amount" type="number" step="any" min="1" required /></label>
      <label>מע״מ *<select name="vat_mode" required defaultValue=""><option value="" disabled>בחר</option>{Object.entries(VAT_MODE_HE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      {kind === 'retainer'
        ? <label>יום תשלום בחודש *<input name="payment_day" type="number" min="1" max="28" required defaultValue={1} /></label>
        : <label>מספר תשלומים<input name="installments" type="number" min="1" max="36" defaultValue={1} /></label>}
      <label>תבנית מע״מ ותנאים<select name="terms_template_id" defaultValue=""><option value="">—</option>{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <span className="hint">לחישוב סכום כולל מע״מ. בלי תבנית — לא מחושב.</span></label>
      <label>{kind === 'retainer' ? 'תחילת ריטיינר' : 'מועד תשלום ראשון'}<input name="start_date" type="date" /></label>
      {kind === 'retainer' && <label>סיום (אם ידוע)<input name="end_date" type="date" /></label>}
    </div>
    <label>הערות<textarea name="notes" /></label>
    <div className="row"><button className="btn y" disabled={busy}>{busy ? 'שומר…' : clientId ? 'הוסף הסדר תשלום' : 'צור לקוח'}</button>
      {msg && <span className="small" role="status" style={{ color: msg.ok ? 'var(--ok)' : 'var(--bad)' }}>{msg.t}</span>}</div>
  </form>;
}
