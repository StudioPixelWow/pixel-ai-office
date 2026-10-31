'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';

export function PortalCard({ clientId, url, onb }: { clientId: string; url: string; onb?: boolean }) {
  const r = useRouter(); const [copied, setCopied] = useState(false); const [note, setNote] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const run = async (action: string, payload: any, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true); setNote(null);
    try { const d = await callAction(action, payload); setNote(d?.note ?? 'בוצע'); r.refresh(); } catch (e: any) { setNote(e.message); } finally { setBusy(false); }
  };
  return <div className="card portal-card">
    <h2>פורטל לקוח</h2>
    <p className="small muted">קישור אישי ללקוח: התקדמות, אישור פוסטים בלחיצה, תשלומים ופגישות. בלי סיסמה, ואפשר להחליף אותו בכל רגע.</p>
    <div className="portal-url" dir="ltr">{url.replace(/^https?:\/\//, '').slice(0, 46)}…</div>
    <div className="portal-act">
      <button className="btn y sm" disabled={busy} onClick={() => run('portal_share', { client_id: clientId })}>שליחה ללקוח</button>
      <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'הועתק ✓' : 'העתקה'}</button>
      <a className="btn sm ghost" href={url} target="_blank" rel="noreferrer">תצוגה ↗</a>
      {!onb && <button className="btn sm" disabled={busy} onClick={() => run('onboarding_start', { client_id: clientId })}>פתיחת צ׳קליסט קליטה</button>}
      <button className="btn sm ghost" disabled={busy} onClick={() => run('portal_rotate', { client_id: clientId }, 'להחליף קישור? הקישור הנוכחי יפסיק לעבוד מיד.')}>החלפה</button>
    </div>
    {!onb && <p className="small muted" style={{ marginTop: 8 }}>צ׳קליסט קליטה: לוגו, מיתוג, תמונות, גישות למטא/גוגל/אתר ושאלון. יופיע ללקוח בפורטל רק אחרי לחיצה.</p>}
    {note && <p className="small" style={{ marginTop: 8 }}>{note}</p>}
  </div>;
}
