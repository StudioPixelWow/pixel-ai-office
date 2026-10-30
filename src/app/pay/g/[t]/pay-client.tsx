'use client';
import { useEffect, useRef, useState } from 'react';
declare global { interface Window { growPayment?: any } }
const SDK = 'https://cdn.meshulam.co.il/sdk/gs.min.js';
function loadSdk(): Promise<void> {
  return new Promise((res, rej) => { if (window.growPayment) return res(); const ex = document.querySelector(`script[src="${SDK}"]`) as HTMLScriptElement | null;
    const s = ex ?? Object.assign(document.createElement('script'), { src: SDK, async: true }); s.addEventListener('load', () => res()); s.addEventListener('error', () => rej(new Error('sdk'))); if (!ex) document.body.appendChild(s); });
}
export function PayClient({ t, name, phone, email, disabled, returnUrl }: { t: string; name: string; phone: string; email: string; disabled?: boolean; returnUrl?: string }) {
  const [f, setF] = useState({ name, phone: phone.replace(/^\+972/, '0'), email }); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState<null | 'ok' | 'fail'>(null);
  const inited = useRef<string | null>(null);
  useEffect(() => { loadSdk().catch(() => {}); }, []);
  async function pay(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await fetch('/api/public/pay/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t, ...f }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'שגיאה');
      if (j.url && !j.authCode) { window.location.href = j.url; return; }
      await loadSdk(); const gp = window.growPayment; if (!gp) throw new Error('רכיב התשלום לא נטען — נסו לרענן');
      if (inited.current !== j.env) {
        gp.init({ environment: j.env, version: 1, events: {
          onSuccess: () => { setDone('ok'); setBusy(false); }, onFailure: (x: any) => { setErr(x?.message || 'התשלום נכשל'); setBusy(false); },
          onError: (x: any) => { setErr(x?.message || 'שגיאה בתשלום'); setBusy(false); }, onTimeout: () => { setErr('תם הזמן לתשלום — לחצו שוב'); setBusy(false); },
          onWalletChange: (s: any) => { if (s === 'close' || s?.state === 'close') setBusy(false); } } });
        inited.current = j.env;
      }
      gp.renderPaymentOptions(j.authCode);
    } catch (x: any) { setErr(x.message); setBusy(false); }
  }
  if (done === 'ok') return <div className="pay-ok"><b>התשלום התקבל ✓</b><p>תודה! קבלה תישלח אליך בנפרד.</p>{returnUrl && <a className="pay-btn ghost" href={returnUrl}>חזרה להצעה</a>}</div>;
  return <form className="pay-form" onSubmit={pay}>
    <label>שם מלא<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="שם פרטי ושם משפחה" autoComplete="name" /></label>
    <label>טלפון נייד<input required dir="ltr" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="05XXXXXXXX" autoComplete="tel" /></label>
    <label>אימייל לקבלה<input dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@example.com" autoComplete="email" /></label>
    {err && <p className="pay-err">{err}</p>}
    <button className="pay-btn" disabled={busy || disabled}>{busy ? 'פותח תשלום מאובטח…' : 'לתשלום מאובטח'}</button>
    <p className="pay-methods">כרטיס אשראי · Bit · Apple Pay · Google Pay</p>
  </form>;
}
