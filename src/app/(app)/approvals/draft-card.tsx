'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction, callRpc, Modal } from '@/components/client';
import { heError } from '@/lib/errors';
import { he, fmtDateTime } from '@/lib/format';

export function DraftCard({ d, client, contact, sender, isOwner }: { d: any; client: string; contact: any; sender: any; isOwner: boolean }) {
  const r = useRouter(); const [open, setOpen] = useState(false); const [body, setBody] = useState(d.body); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [note, setNote] = useState('');
  const decide = async (decision: string) => { setBusy(true); setMsg(''); try { await callAction('draft_decision', { draft_id: d.id, decision, note }); setOpen(false); r.refresh(); } catch (e) { setMsg(heError(e)); } finally { setBusy(false); } };
  const approve = async () => {
    setBusy(true); setMsg('');
    try { const res = await callRpc('office_approve_and_send', { p_draft: d.id, p_version: d.draft_version, p_shown_hash: d.snapshot_hash, p_body: body });
      if (res.ok) { setOpen(false); r.refresh(); } else setMsg(res.reason); }
    catch (e) { setMsg(heError(e)); } finally { setBusy(false); }
  };
  return <div className="card">
    <div className="row"><b className="sp">{client} · {contact?.name ?? '—'}</b><span className={`badge ${d.status === 'pending_approval' ? 'yellow' : d.status === 'needs_review' ? 'warn' : ''}`}>{he(d.status)}</span></div>
    <p className="small muted">{d.kind} · {d.prepared_by_agent ?? 'ידני'} · {fmtDateTime(d.created_at)}{d.is_test ? ' · [בדיקה]' : ''}</p>
    <p style={{ whiteSpace: 'pre-wrap' }}>{d.body.slice(0, 220)}{d.body.length > 220 ? '…' : ''}</p>
    {d.review_reason && <div className="note warn small">{d.review_reason}</div>}
    <div className="row" style={{ marginTop: 10 }}><button className="btn y sm" onClick={() => setOpen(true)} disabled={!['pending_approval', 'needs_review', 'saved_later'].includes(d.status)}>פתח לבדיקה</button></div>
    <Modal open={open} onClose={() => setOpen(false)} label="אישור הודעה">
      <h2>אישור הודעת WhatsApp</h2>
      <dl className="kv">
        <dt>לקוח / פרויקט</dt><dd>{client}{d.project_id ? ' · פרויקט' : ''}</dd>
        <dt>חשבון שולח</dt><dd>{sender ? `${sender.label} (${he(sender.status)})` : <b style={{ color: 'var(--bad)' }}>לא הוגדר חשבון שולח — לא ניתן לשלוח</b>}</dd>
        <dt>נמען</dt><dd>{contact?.name} · <span className="ltr" dir="ltr">{d.recipient_e164}</span> {contact?.phone_verified ? '✓ מאומת' : '⚠ לא מאומת'}</dd>
        <dt>שיחה</dt><dd>{d.conversation_id ? 'שיחה קיימת' : 'שיחה חדשה (ייתכן שנדרשת תבנית מאושרת מחוץ לחלון 24 שעות)'}</dd>
        <dt>הוכן ע״י</dt><dd>{d.prepared_by_agent ?? 'ידני'} · סוג: {d.kind}</dd>
        <dt>סיבה</dt><dd>{d.reason ?? '—'}</dd><dt>הקשר אחרון</dt><dd className="small">{d.context_excerpt ?? '—'}</dd>
        <dt>מצורפים</dt><dd>{(d.attachments ?? []).length ? d.attachments.map((a: any) => <div key={a.artifact_version_id} className="small">{a.title} · גרסה {a.version_no} · {a.sha256?.slice(0, 10)}</div>) : 'אין'}</dd>
        {d.template_name && <><dt>תבנית</dt><dd>{d.template_name} — זה הנוסח שיישלח בפועל</dd></>}
        <dt>גרסת טיוטה</dt><dd>v{d.draft_version} · {d.snapshot_hash.slice(0, 12)}</dd>
      </dl>
      <label className="f" style={{ marginTop: 12 }}>נוסח מלא (עריכה כאן ואז ״אשר ושלח״ תאשר בדיוק את מה שמוצג)
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} /></label>
      {d.status !== 'pending_approval' && <div className="note warn small" style={{ marginTop: 8 }}>הטיוטה במצב ״{he(d.status)}״. יש להחזיר לתור לפני אישור.</div>}
      {msg && <div className="note bad small" style={{ marginTop: 8 }} role="alert">{msg}</div>}
      <label className="f" style={{ marginTop: 10 }}>הערה לניסוח אחר (אופציונלי)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="row" style={{ marginTop: 14 }}>
        {d.status === 'pending_approval'
          ? <button className="btn y" onClick={approve} disabled={busy || !isOwner} title={isOwner ? '' : 'רק ה-Owner יכול לאשר'}>{busy ? '…' : 'אשר ושלח'}</button>
          : <button className="btn" onClick={() => decide('back_to_queue')} disabled={busy}>החזר לתור לבדיקה</button>}
        <button className="btn" onClick={() => decide('request_rewrite')} disabled={busy}>בקש ניסוח אחר</button>
        <button className="btn" onClick={() => decide('save_later')} disabled={busy}>שמור לאחר כך</button>
        <button className="btn danger" onClick={() => decide('cancel')} disabled={busy}>בטל</button>
        <button className="btn ghost" onClick={() => setOpen(false)}>סגור (לא אישור)</button></div>
    </Modal></div>;
}
