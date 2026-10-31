'use client';
import React, { useState } from 'react';
import { Globe, Mail, MessageCircle, Send } from 'lucide-react';
import { Modal } from '@/components/client';

// small, neutral glyphs for the social networks (lucide dropped brand icons)
const G: Record<string, React.ReactNode> = {
  facebook: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v8h4v-8h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8Z"/></svg>,
  instagram: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>,
  linkedin: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M4 9h4v12H4zM6 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm4 6h3.8v1.7c.6-1 1.9-2 3.9-2 4 0 4.3 2.6 4.3 6V21h-4v-5.5c0-1.4 0-3.1-1.9-3.1S12 13.9 12 15.4V21h-2z"/></svg>,
  tiktok: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M16 3c.4 2.3 1.9 3.8 4 4v3.4c-1.5 0-2.9-.5-4-1.2V15a6 6 0 1 1-6-6v3.5a2.5 2.5 0 1 0 2.5 2.5V3z"/></svg>,
  youtube: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M22 8.2c-.2-1.6-1-2.6-2.6-2.8C17 5 12 5 12 5s-5 0-7.4.4C3 5.6 2.2 6.6 2 8.2 1.8 9.5 1.8 12 1.8 12s0 2.5.2 3.8c.2 1.6 1 2.6 2.6 2.8C7 19 12 19 12 19s5 0 7.4-.4c1.6-.2 2.4-1.2 2.6-2.8.2-1.3.2-3.8.2-3.8s0-2.5-.2-3.8ZM10 15V9l5.2 3z"/></svg>,
};
const NET: [string, string][] = [['facebook', 'פייסבוק'], ['instagram', 'אינסטגרם'], ['linkedin', 'לינקדאין'], ['tiktok', 'טיקטוק'], ['youtube', 'יוטיוב']];
const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

export function ClientLinks({ clientId, clientName, profile, contacts }: { clientId: string; clientName: string; profile: any; contacts: any[] }) {
  const web: string | undefined = profile?.website; const so: Record<string, string> = profile?.socials ?? {}; const other: string[] = profile?.other_sites ?? [];
  const sites = [...(web ? [web] : []), ...other];
  const phones = contacts.filter((c) => c.phone_e164 && !c.opted_out_at); const mails = contacts.filter((c) => c.email);
  const [wa, setWa] = useState(false); const [mail, setMail] = useState(false);
  const openWa = (ph: string) => window.open(`https://wa.me/${ph.replace(/\D/g, '')}`, '_blank', 'noopener');
  return <div className="cl-bar">
    <div className="cl-links">
      {sites.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="cl-site"><Globe size={16} />{host(u)}</a>)}
      {NET.filter(([k]) => so[k]).map(([k, l]) => <a key={k} href={so[k]} target="_blank" rel="noreferrer" className={`cl-net ${k}`} title={l} aria-label={l}>{G[k]}<span>{l}</span></a>)}
      {!sites.length && !NET.some(([k]) => so[k]) && <span className="muted small">אין עדיין אתר ורשתות בכרטיס</span>}
    </div>
    <div className="cl-quick">
      <button className="btn sm cl-wa" disabled={!phones.length} title={phones.length ? 'פותח שיחה בוואטסאפ שלך' : 'אין איש קשר עם טלפון'} onClick={() => phones.length === 1 ? openWa(phones[0].phone_e164) : setWa(true)}><MessageCircle size={16} /> וואטסאפ</button>
      <button className="btn sm cl-mail" onClick={() => setMail(true)}><Mail size={16} /> מייל ללקוח</button>
    </div>
    {wa && <Modal open onClose={() => setWa(false)} label="וואטסאפ"><h2>וואטסאפ ל{clientName}</h2><p className="small muted">נפתחת שיחה בוואטסאפ שלך, ואתה כותב ושולח משם.</p>
      <div className="cl-pick">{phones.map((c) => <button key={c.id} className="btn" onClick={() => { openWa(c.phone_e164); setWa(false); }}><MessageCircle size={16} /> {c.name}{c.role_title ? ` · ${c.role_title}` : ''} <span dir="ltr">{c.phone_e164}</span></button>)}</div></Modal>}
    {mail && <EmailCompose clientId={clientId} clientName={clientName} mails={mails} onClose={() => setMail(false)} />}
  </div>;
}

function EmailCompose({ clientId, clientName, mails, onClose }: { clientId: string; clientName: string; mails: any[]; onClose: () => void }) {
  const [to, setTo] = useState(mails[0]?.email ?? ''); const [cc, setCc] = useState(''); const [subject, setSubject] = useState(''); const [body, setBody] = useState(mails[0]?.name ? `היי ${String(mails[0].name).split(' ')[0]},\n\n` : 'היי,\n\n');
  const [busy, setBusy] = useState(false); const [note, setNote] = useState<{ ok: boolean; t: string } | null>(null);
  const send = async () => {
    if (!window.confirm(`לשלוח את המייל ל-${to}?`)) return; setBusy(true); setNote(null);
    try { const r = await fetch(`/api/clients/${clientId}/email`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to, cc, subject, body }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setNote({ ok: true, t: 'המייל נשלח ✓' }); setTimeout(onClose, 1200); } catch (e: any) { setNote({ ok: false, t: e.message }); } finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} label="מייל ללקוח"><div className="rd-reply">
    <h2>מייל ל{clientName}</h2>
    {mails.length > 1 && <div className="cl-pick">{mails.map((c) => <button key={c.id} className={`btn sm ${to === c.email ? 'y' : 'ghost'}`} onClick={() => setTo(c.email)}>{c.name}</button>)}</div>}
    <label>אל<input dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@company.co.il" /></label>
    <label>העתק (לא חובה)<input dir="ltr" value={cc} onChange={(e) => setCc(e.target.value)} /></label>
    <label>נושא<input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
    <label>תוכן<textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} /></label>
    <div className="rd-act"><button className="btn y" disabled={busy || !to.trim() || !subject.trim() || !body.trim()} onClick={send}><Send size={16} /> {busy ? 'שולח…' : 'שליחה'}</button><span className="small muted">יוצא מ-office@ בעיצוב פיקסל ועם החתימה</span></div>
    {note && <p className={`small ${note.ok ? 'ok-t' : 'err'}`}>{note.t}</p>}
  </div></Modal>;
}
