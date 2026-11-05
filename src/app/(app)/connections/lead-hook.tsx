'use client';
import { useState } from 'react';
// Inbound leads address for Make: create it once, copy it into Make's HTTP module. Shown only at creation.
export function LeadHook({ status }: { status: { active: boolean; last: string | null; count: number } | null }) {
  const [url, setUrl] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [copied, setCopied] = useState('');
  const make = async () => { if (status?.active && !window.confirm('ליצור כתובת חדשה? הכתובת הקודמת תפסיק לעבוד, וצריך לעדכן אותה ב-Make.')) return;
    setBusy(true); setErr(null); const j = await fetch('/api/lead-hook', { method: 'POST' }).then((r) => r.json()).catch(() => ({ error: 'אין חיבור' })); setBusy(false); if (j.error) setErr(j.error); else setUrl(j.url); };
  const copy = (t: string, k: string) => { navigator.clipboard?.writeText(t); setCopied(k); setTimeout(() => setCopied(''), 1500); };
  const loud = url ? `${url}?brand=loud` : '';
  return <div className="card" style={{ marginBottom: 12 }}>
    <div className="row"><h2 className="sp">קליטת לידים מבחוץ (Make)</h2>{status?.active ? <span className="badge ok">פעיל · {status.count} לידים נקלטו</span> : <span className="badge">לא הוגדר</span>}</div>
    <p className="small muted">כתובת שאליה Make שולח כל ליד חדש, במקביל ל-Google Sheets. הליד נפתח במערכת עם התראה. אותו טלפון או מייל בתוך 24 שעות נקלט פעם אחת.</p>
    {!url ? <button className="btn y" disabled={busy} onClick={make}>{busy ? 'יוצר…' : status?.active ? 'יצירת כתובת חדשה' : '✦ יצירת כתובת לקליטת לידים'}</button>
    : <div style={{ display: 'grid', gap: 8 }}>
        <p className="small"><b>הכתובת מוצגת עכשיו בלבד.</b> העתק אותה ל-Make. אם תאבד אותה, אפשר ליצור חדשה.</p>
        <div className="cs-link"><span dir="ltr">כתובת ללידים של LOUD</span><button className="btn sm y" onClick={() => copy(loud, 'loud')}>{copied === 'loud' ? '✓ הועתק' : 'העתקה'}</button></div>
        <div className="cs-link"><span dir="ltr">כתובת כללית (בלי מותג)</span><button className="btn sm" onClick={() => copy(url, 'gen')}>{copied === 'gen' ? '✓ הועתק' : 'העתקה'}</button></div>
        <ol className="small" style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.8 }}>
          <li>ב-Make, בסנריו של LOUD: מוסיפים מודול <b>HTTP › Make a request</b> אחרי הטריגר (בנוסף ל-Google Sheets).</li>
          <li>URL: הכתובת של LOUD · Method: <b>POST</b> · Body type: <b>Raw</b> · Content type: <b>JSON (application/json)</b>.</li>
          <li>Request content: <span dir="ltr">{'{"name": "…", "phone": "…", "email": "…", "message": "…", "source": "…"}'}</span> עם המיפוי מהטריגר.</li>
          <li>מריצים פעם אחת (Run once) ובודקים שהליד הופיע בלידים.</li>
        </ol></div>}
    {status?.last && <p className="small muted" style={{ marginTop: 8 }}>ליד אחרון נקלט: {new Date(status.last).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}</p>}
    {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
  </div>;
}
