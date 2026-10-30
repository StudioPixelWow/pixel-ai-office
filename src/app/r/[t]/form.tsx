'use client';
import { useState } from 'react';
export function ReferralForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [err, setErr] = useState('');
  async function send(f: FormData) {
    setBusy(true); setErr('');
    const r = await fetch(`/api/public/referral/${token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(f)) });
    const j = await r.json().catch(() => ({})); setBusy(false); if (!r.ok) { setErr(j.error ?? 'משהו השתבש, נסו שוב'); return; } setDone(true);
  }
  if (done) return <div className="ref-done"><b>תודה! 🙌</b><p>קיבלנו את הפרטים ונחזור אליכם בהקדם.</p></div>;
  return <form className="ref-form" onSubmit={(e) => { e.preventDefault(); send(new FormData(e.currentTarget)); }}>
    <label>שם מלא *<input name="name" required /></label>
    <label>טלפון *<input name="phone" type="tel" dir="ltr" required /></label>
    <label>מייל<input name="email" type="email" dir="ltr" /></label>
    <label>שם העסק<input name="business" /></label>
    <label>במה נוכל לעזור?<textarea name="note" rows={3} /></label>
    <input name="website" className="hp" tabIndex={-1} autoComplete="off" aria-hidden />
    <button className="btn y" disabled={busy}>{busy ? 'שולח…' : 'שלחו לי פרטים'}</button>{err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
    <p className="small muted">הפרטים משמשים רק כדי לחזור אליכם.</p>
  </form>;
}
