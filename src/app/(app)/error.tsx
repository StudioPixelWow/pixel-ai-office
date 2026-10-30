'use client';
import { useEffect } from 'react';
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <div className="err-page"><div className="err-ico">⚠</div><h1>משהו לא נטען כמו שצריך</h1>
    <p className="muted">ייתכן שזה רגעי. אפשר לנסות שוב — ואם זה חוזר, הפרטים נשמרו ביומן השגיאות.</p>
    <p className="small muted" dir="ltr">{error.digest ?? String(error.message).slice(0, 140)}</p>
    <div className="row" style={{ justifyContent: 'center' }}><button className="btn y" onClick={() => reset()}>נסה שוב</button><a className="btn ghost" href="/">למרכז הבקרה</a></div></div>;
}
