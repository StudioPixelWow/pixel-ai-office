'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function SamplesForm({ clientId }: { clientId: string }) {
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const router = useRouter();
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    const r = await fetch(`/api/clients/${clientId}/samples`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return setMsg(j.error || 'שגיאה');
    setMsg(`נוספו ${j.added} דוגמאות (${j.enriched} עם טקסט ותמונה) · סה״כ ${j.total} בבנק`); setText(''); router.refresh();
  }
  return <form className="bb-card" onSubmit={go} style={{ marginTop: 14 }}>
    <h3>הוספת דוגמאות תוכן</h3>
    <p className="small muted">הדביקו קישורים לפוסטים, רילסים וסרטונים — שורה לכל קישור (אפשר להוסיף מספר צפיות אחרי רווח). טיקטוק ויוטיוב נמשכים אוטומטית עם טקסט ותמונה; אינסטגרם ופייסבוק נשמרים כקישור עד חיבור Meta.</p>
    <textarea dir="ltr" value={text} onChange={(e) => setText(e.target.value)} placeholder={'https://www.tiktok.com/@user/video/123 2836\nhttps://www.instagram.com/reel/ABC/'} rows={5} />
    <div className="row" style={{ marginTop: 8 }}><button className="btn y" disabled={busy || !text.trim()}>{busy ? 'מושך תוכן…' : 'משוך לבנק הנכסים'}</button>{msg && <span className="small">{msg}</span>}</div>
  </form>;
}
