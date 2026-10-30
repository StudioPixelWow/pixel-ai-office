'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction, Modal } from '@/components/client';
import { heError } from '@/lib/errors';

const ST: Record<string, [string, string]> = { new: ['חדש', 'muted'], drafted: ['ממתין לאישורך', 'yellow'], sent: ['נשלח', 'cyan'], replied: ['ענה', 'ok'], won: ['חזר ללקוח 🎉', 'ok'], skip: ['דילגנו', 'muted'] };
// Past clients: paste a list → one personal message each (preview, edit, then an approval-gated draft).
export function Winback({ rows }: { rows: any[] }) {
  const r = useRouter(); const [paste, setPaste] = useState(''); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const [open, setOpen] = useState<any>(null); const [body, setBody] = useState(''); const [hint, setHint] = useState(''); const [idea, setIdea] = useState('');
  const counts = Object.fromEntries(Object.keys(ST).map((k) => [k, rows.filter((x) => x.status === k).length]));
  async function add() {
    const lines = paste.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\t|,|;/).map((x) => x.trim()));
    const data = lines.map(([name, business, phone, email, past_service, ended, website]) => ({ name, business, phone, email, past_service, ended, website }));
    setBusy('add'); try { const x = await callAction('winback_add', { rows: data }); setMsg(x.note); setPaste(''); r.refresh(); } catch (e) { setMsg(heError(e)); } finally { setBusy(''); }
  }
  async function gen(w: any) {
    setBusy(w.id); setMsg('');
    try { const x = await fetch(`/api/winback/${w.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hint }) }); const j = await x.json(); if (!x.ok) throw new Error(j.error);
      setOpen(w); setBody(j.body); setIdea(j.idea ?? ''); } catch (e) { setMsg(heError(e)); } finally { setBusy(''); }
  }
  async function save() {
    setBusy('save'); try { const x = await fetch(`/api/winback/${open.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ save: true, body }) }); const j = await x.json(); if (!x.ok) throw new Error(j.error);
      setMsg(j.note); setOpen(null); r.refresh(); } catch (e) { setMsg(heError(e)); } finally { setBusy(''); }
  }
  return <>
    <div className="hero"><h1>החזרת <span className="mark">לקוחות עבר</span></h1>
      <p>מכניסים רשימה של לקוחות קודמים. לכל אחד נכתבת הודעה אישית עם רעיון שמתאים לעסק שלו היום, וההודעה מחכה לאישור שלך. שום דבר לא נשלח לבד.</p></div>
    <div className="wb-stats">{Object.entries(ST).map(([k, [l]]) => <div key={k}><b>{counts[k] ?? 0}</b><small>{l}</small></div>)}</div>
    <div className="card"><h2>הוספת לקוחות</h2>
      <p className="small muted">שורה לכל לקוח, מופרד בפסיקים (או העתקה מאקסל): <b>שם, עסק, טלפון, מייל, מה עשינו, מתי הסתיים, אתר</b>. רק שם וטלפון חובה.</p>
      <textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'דני כהן, מסעדת הים, 0521234567, , ניהול סושיאל וקמפיינים, 2025, www.example.co.il'} dir="auto" />
      <div className="row"><button className="btn y" disabled={!paste.trim() || busy === 'add'} onClick={add}>הוסף לרשימה</button>{msg && <span className="small">{msg}</span>}</div></div>
    <div className="card" style={{ marginTop: 14 }}><div className="row"><h2 className="sp">הרשימה ({rows.length})</h2>
      <input placeholder="הנחיה לכל ההודעות (לא חובה) — למשל: להזכיר הנחת חזרה" value={hint} onChange={(e) => setHint(e.target.value)} style={{ maxWidth: 380 }} /></div>
      <div className="wb-list">{rows.map((w) => { const [l, t] = ST[w.status] ?? [w.status, 'muted'];
        return <div key={w.id} className="wb-row"><div className="sp"><b>{w.name}{w.business ? ` · ${w.business}` : ''}</b>
          <small>{[w.past_service, w.ended && `הסתיים ${w.ended}`, w.phone_e164 ?? 'אין טלפון'].filter(Boolean).join(' · ')}</small>{w.draft_body && <p className="wb-draft">{w.draft_body}</p>}</div>
          <span className={`badge ${t}`}>{l}</span>
          <div className="wb-act">{w.phone_e164 && ['new', 'drafted', 'skip'].includes(w.status) && <button className="btn sm y" disabled={busy === w.id} onClick={() => gen(w)}>{busy === w.id ? 'כותב…' : w.status === 'drafted' ? 'כתוב מחדש' : 'כתוב הודעה'}</button>}
            <select value="" onChange={(e) => e.target.value && callAction('winback_status', { id: w.id, status: e.target.value }).then(() => r.refresh())} aria-label="סטטוס">
              <option value="">סמן…</option><option value="sent">נשלח</option><option value="replied">ענה</option><option value="won">חזר ללקוח</option><option value="skip">לדלג</option><option value="new">החזר לחדש</option></select></div></div>; })}
        {!rows.length && <p className="muted">עוד אין לקוחות ברשימה.</p>}</div></div>
    <Modal open={!!open} onClose={() => setOpen(null)} label="הודעה ללקוח עבר">
      {open && <div className="f"><h2>הודעה ל{open.name}</h2>{idea && <p className="small muted">💡 {idea}</p>}
        <textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
        <p className="small muted">שמירה יוצרת טיוטה במרכז האישורים. היא תישלח רק אחרי שתאשר אותה שם.</p>
        <div className="row"><button className="btn y" disabled={busy === 'save' || body.trim().length < 10} onClick={save}>שמור לאישור</button><button className="btn ghost" onClick={() => gen(open)}>נסח אחרת</button></div></div>}
    </Modal>
  </>;
}
