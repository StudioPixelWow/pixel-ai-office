'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const ERR: Record<string, string> = { already_signed: 'ההצעה כבר נחתמה', link_invalid_or_expired: 'הקישור אינו בתוקף', 'missing:signer_name': 'נא למלא שם מלא', 'missing:signature': 'נא לחתום במסגרת', sign_first: 'יש לחתום לפני התשלום' };
const he = (m: string) => Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? 'אירעה שגיאה, נסו שוב';

/** Client signature: typed full name + hand-drawn signature + explicit consent. Then optional payment via Grow. */
export function SignPanel({ token, signed, signerName, signedAt, canPay, paymentUrl }: { token: string; signed: boolean; signerName?: string; signedAt?: string; canPay: boolean; paymentUrl?: string | null }) {
  const r = useRouter(); const cv = useRef<HTMLCanvasElement>(null); const drawing = useRef(false); const [has, setHas] = useState(false);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [ok, setOk] = useState(false);
  useEffect(() => { const c = cv.current; if (!c) return; const ratio = window.devicePixelRatio || 1; const w = c.clientWidth; c.width = w * ratio; c.height = 160 * ratio;
    const g = c.getContext('2d')!; g.scale(ratio, ratio); g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#0B1320'; }, [signed]);
  const pos = (e: React.PointerEvent) => { const b = cv.current!.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const down = (e: React.PointerEvent) => { drawing.current = true; cv.current!.setPointerCapture(e.pointerId); const g = cv.current!.getContext('2d')!; const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const g = cv.current!.getContext('2d')!; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); setHas(true); };
  const clear = () => { const c = cv.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setHas(false); };
  async function sign(f: FormData) {
    if (!has) { setMsg('נא לחתום במסגרת'); return; } if (!f.get('agree')) { setMsg('יש לאשר את תנאי ההצעה'); return; }
    setBusy(true); setMsg('');
    try { const sig = cv.current!.toDataURL('image/png').split(',')[1];
      const x = await fetch(`/api/public/proposals/${token}/sign`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: f.get('name'), title: f.get('title'), signature: sig }) });
      const j = await x.json(); if (!x.ok) throw new Error(j.error); setOk(true); r.refresh(); } catch (e: any) { setMsg(he(String(e.message))); } finally { setBusy(false); }
  }
  async function pay() {
    setBusy(true); setMsg('');
    try { const x = await fetch(`/api/public/proposals/${token}/pay`, { method: 'POST' }); const j = await x.json(); if (!x.ok) throw new Error(j.error); window.location.href = j.url; }
    catch (e: any) { setMsg(String(e.message) || 'לא ניתן ליצור תשלום כרגע'); setBusy(false); }
  }
  if (signed || ok) return <div className="pub-card"><h2>✓ ההצעה נחתמה{signerName ? ` על ידי ${signerName}` : ''}</h2>
    <p>תודה! עותק ההצעה החתומה נשמר אצלנו{signedAt ? ` (${new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' }).format(new Date(signedAt))})` : ''}. ניצור קשר לתיאום פגישת ההתנעה.</p>
    {(canPay || paymentUrl) && <><p>אפשר לשלם עכשיו בצורה מאובטחת באשראי או ב-Bit:</p><button className="btn y" disabled={busy} onClick={pay}>{busy ? 'מעביר לתשלום…' : 'לתשלום מאובטח'}</button></>}
    <button className="btn ghost" onClick={() => window.print()}>הדפסה / שמירה כ-PDF</button>{msg && <p className="small" style={{ color: 'var(--bad)' }}>{msg}</p>}</div>;
  return <form className="pub-card f" onSubmit={(e) => { e.preventDefault(); sign(new FormData(e.currentTarget)); }}>
    <h2>אישור וחתימה דיגיטלית</h2>
    <div className="grid g2"><label>שם מלא *<input name="name" required minLength={2} /></label><label>תפקיד<input name="title" /></label></div>
    <label>חתימה *<span className="sig-wrap"><canvas ref={cv} className="sig" onPointerDown={down} onPointerMove={move} onPointerUp={() => (drawing.current = false)} onPointerLeave={() => (drawing.current = false)} aria-label="משטח חתימה" /></span></label>
    <div className="row"><button type="button" className="btn ghost sm" onClick={clear}>נקה חתימה</button></div>
    <label className="agree"><input type="checkbox" name="agree" /> <span>קראתי ואני מאשר/ת את ההצעה, התכולה והמחיר המפורטים בה</span></label>
    <div className="row"><button className="btn y" disabled={busy}>{busy ? 'חותם…' : 'אני מאשר/ת וחותם/ת'}</button><button type="button" className="btn ghost" onClick={() => window.print()}>הדפסה / PDF</button></div>
    {msg && <p className="small" style={{ color: 'var(--bad)' }}>{msg}</p>}
    <p className="small muted">החתימה נשמרת יחד עם תאריך, שעה וטביעת תוכן של ההצעה, כך שאי אפשר לשנות את ההצעה החתומה.</p>
  </form>;
}
