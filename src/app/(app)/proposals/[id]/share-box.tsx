'use client';
import { useState } from 'react';
import { callAction, Modal } from '@/components/client';
import { heError } from '@/lib/errors';

/** Owner: create the client's signing link and send it personally (WhatsApp / mail app) or via Gmail with a preview. */
export function ShareBox({ proposalId, company, contactName, phone, email, gmail, hasLink }:
  { proposalId: string; company: string; contactName?: string | null; phone?: string | null; email?: string | null; gmail: boolean; hasLink: boolean }) {
  const [url, setUrl] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [prev, setPrev] = useState(false);
  const first = (contactName ?? '').split(' ')[0] || '';
  const text = (u: string) => `היי ${first},\nמצורפת הצעת המחיר של Studio Pixel עבור ${company}.\nאפשר לעיין, לחתום דיגיטלית ולשלם ישירות בקישור:\n${u}\n\nטל · Studio Pixel`;
  async function make() { setBusy(true); setMsg(''); try { const d = await callAction('create_share_link', { proposal_id: proposalId }); setUrl(`${location.origin}/p/${d.token}`); } catch (e) { setMsg(heError(e)); } finally { setBusy(false); } }
  async function sendMail() {
    setBusy(true); setMsg('');
    try { const r = await fetch('/api/proposals/send-email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proposal_id: proposalId, url, to: email }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error); setMsg(`נשלח ל-${email}`); setPrev(false); } catch (e) { setMsg(heError(e)); } finally { setBusy(false); }
  }
  const wa = phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text(url ?? ''))}` : null;
  return <div className="f">
    {!url ? <><button className="btn y" disabled={busy} onClick={make}>{hasLink ? 'צור קישור חדש לחתימה' : 'צור קישור לחתימה ותשלום'}</button>
      {hasLink && <span className="small muted">קישור קודם קיים. קישור חדש מבטל את הקודם.</span>}</>
      : <>
        <label>קישור ללקוח<input readOnly value={url} dir="ltr" onFocus={(e) => e.currentTarget.select()} /></label>
        <div className="row">
          <button className="btn" onClick={() => navigator.clipboard.writeText(url).then(() => setMsg('הועתק'))}>העתק</button>
          {wa ? <a className="btn" href={wa} target="_blank" rel="noreferrer">שלח בוואטסאפ שלי</a> : <span className="small muted">אין טלפון בליד</span>}
          {email ? <a className="btn" href={`mailto:${email}?subject=${encodeURIComponent(`הצעת מחיר — ${company} · Studio Pixel`)}&body=${encodeURIComponent(text(url))}`}>פתח במייל שלי</a> : <span className="small muted">אין דוא״ל בליד</span>}
          {email && <button className="btn y" disabled={!gmail || busy} title={gmail ? '' : 'Gmail לא מחובר'} onClick={() => setPrev(true)}>שלח מ-office@ במייל</button>}
        </div>
        <p className="small muted">וואטסאפ ומייל נפתחים אצלך עם טקסט מוכן — אתה שולח בעצמך. שליחה מ-office@ מוצגת קודם לאישור.</p></>}
    {msg && <span className="small" role="status">{msg}</span>}
    <Modal open={prev} onClose={() => setPrev(false)} label="תצוגה מקדימה למייל">
      <h2>תצוגה מקדימה</h2><p className="small">אל: <b dir="ltr">{email}</b> · מאת: office@s-pixel.co.il</p>
      <p className="small">נושא: <b>הצעת מחיר — {company} · Studio Pixel</b></p>
      <pre className="out" style={{ whiteSpace: 'pre-wrap' }}>{url && text(url)}</pre>
      <div className="row"><button className="btn y" disabled={busy} onClick={sendMail}>{busy ? 'שולח…' : 'אשר ושלח'}</button><button className="btn ghost" onClick={() => setPrev(false)}>ביטול</button></div>
    </Modal>
  </div>;
}
