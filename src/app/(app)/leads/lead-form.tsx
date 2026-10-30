'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';
import { SERVICES } from '@/lib/services';

export const toE164 = (p: string) => { const d = p.replace(/[^\d+]/g, ''); if (!d) return ''; if (d.startsWith('+')) return d; if (d.startsWith('972')) return '+' + d; if (d.startsWith('0')) return '+972' + d.slice(1); return d; };

/** Manual lead: contact, company, field of business, phone, email, requested services. */
export function LeadForm() {
  const r = useRouter(); const [svc, setSvc] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? '').trim();
    setBusy(true); setMsg('');
    try { const d = await callAction('create_lead', { company: v('company'), contact_name: v('contact_name'), industry: v('industry'), contact_phone_e164: toE164(v('phone')),
        contact_email: v('email'), requested_services: svc, need: v('need'), source: 'manual' });
      r.push(`/leads/${d.id}${d.duplicate ? '?dup=1' : ''}`); }
    catch (err) { setMsg(heError(err)); } finally { setBusy(false); }
  }
  return <form className="f" onSubmit={submit}>
    <div className="grid g2"><label>שם הלקוח (איש קשר) *<input name="contact_name" required /></label><label>חברה *<input name="company" required /></label>
      <label>עיסוק / תחום<input name="industry" placeholder="למשל: מרפאת שיניים" /></label><label>טלפון<input name="phone" type="tel" dir="ltr" placeholder="050-0000000" /></label>
      <label>דוא״ל<input name="email" type="email" dir="ltr" /></label></div>
    <fieldset className="chips"><legend className="small muted">סוג שירות</legend>
      {SERVICES.map((s) => <label key={s.key} className={`chip ${svc.includes(s.key) ? 'on' : ''}`}><input type="checkbox" checked={svc.includes(s.key)} onChange={() => setSvc((x) => x.includes(s.key) ? x.filter((y) => y !== s.key) : [...x, s.key])} />{s.label}</label>)}</fieldset>
    <label>הערות / צורך<textarea name="need" /></label>
    <div className="row"><button className="btn y" disabled={busy}>{busy ? 'שומר…' : 'שמור ליד'}</button>{msg && <span className="small" style={{ color: 'var(--bad)' }}>{msg}</span>}</div>
  </form>;
}
