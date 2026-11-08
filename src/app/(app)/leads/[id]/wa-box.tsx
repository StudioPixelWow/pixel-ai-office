'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { waLink } from '@/lib/wa';
// WhatsApp opener for a lead: ready text (brand script + first name), editable, sent by Tal from his own WhatsApp Business app.
export function WaBox({ leadId, phone, text, openedAt }: { leadId: string; phone: string | null; text: string; openedAt: string | null }) {
  const [t, setT] = useState(text); const [opened, setOpened] = useState(openedAt); const [copied, setCopied] = useState(false);
  const link = waLink(phone, t);
  const open = () => { if (!link) return; window.open(link, '_blank');
    supabaseBrowser().rpc('office_lead_wa_opened', { p_lead: leadId }).then(() => setOpened(new Date().toISOString())); };
  const copy = () => { navigator.clipboard?.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return <div className="card wa-box">
    <div className="row"><h2 className="sp">💬 וואטסאפ לליד</h2>{opened ? <span className="badge ok">נפתחה שיחה · {new Date(opened).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> : <span className="badge warn">עוד לא פנית</span>}</div>
    {!phone ? <p className="small muted">אין טלפון לליד הזה.</p> : <>
      <div className="wa-chat"><textarea className="wa-bubble" rows={Math.min(12, t.split('\n').length + 1)} value={t} onChange={(e) => setT(e.target.value)} /></div>
      <div className="wa-actions">
        <button className="btn wa-send" onClick={open}>פתיחה בוואטסאפ ושליחה</button>
        <button className="btn sm" onClick={copy}>{copied ? '✓ הועתק' : 'העתקת הטקסט'}</button>
      </div>
      <p className="small muted">נפתח וואטסאפ בטלפון עם ההודעה מוכנה, ואתה לוחץ שליחה. השיחה עצמה מתנהלת באפליקציה בטלפון. המערכת רושמת רק שפתחת שיחה.</p></>}
  </div>;
}
