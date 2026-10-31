'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { callAction, callRpc, Modal } from '@/components/client';
import { heError } from '@/lib/errors';
import { ago, fmtDateTime } from '@/lib/format';

const KIND: Record<string, string> = { request: 'בקשה', approval: 'אישור', feedback: 'משוב', complaint: 'תלונה', payment: 'תשלום', meeting: 'פגישה', lead: 'פנייה חדשה', info: 'מידע', noise: 'אוטומטי' };
const ST: Record<string, [string, string]> = { needs_match: ['להתאים ללקוח', 'yellow'], task: ['נפתחה משימה', 'ok'], lead: ['ליד חדש', 'cyan'], info: ['מידע', 'muted'], dismissed: ['לא רלוונטי', 'muted'], skipped: ['פרסומי / אוטומטי', 'muted'], new: ['חדש', 'muted'] };
const TABS: [string, string][] = [['main', 'דואר נכנס'], ['needs_match', 'להתאים'], ['task', 'משימות'], ['lead', 'לידים'], ['skipped', 'פרסומות ואוטומטי']];
const BY: Record<string, string> = { contact: 'איש קשר', lead: 'ליד', learned: 'שולח מוכר', domain: 'דומיין', manual: 'שויך ידנית' };
const short = (mb: string) => mb.split('@')[0] + '@';

// Inbox: every new email in the connected mailboxes; איריס classifies and opens follow-up tasks, and you read & reply from here.
export function InboxView({ d }: { d: any }) {
  const r = useRouter(); const items: any[] = d.items ?? [];
  const boxes: string[] = [...new Set<string>([...(d.state ?? []).map((s: any) => s.mailbox), ...items.map((x) => x.mailbox)].filter(Boolean))];
  const [mb, setMb] = useState(''); const [tab, setTab] = useState(items.some((x) => x.status === 'needs_match') ? 'needs_match' : 'main');
  const [pick, setPick] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const [open, setOpen] = useState<string | null>(null);
  const run = async (id: string, action: string, extra: any = {}) => { setBusy(id + action); setMsg(''); try { const x = await callAction(action, { id, ...extra }); setMsg(x?.note ?? 'עודכן'); r.refresh(); } catch (e) { setMsg(heError(e)); } finally { setBusy(''); } };
  const inBox = items.filter((x) => !mb || x.mailbox === mb);
  const shown = inBox.filter((x) => tab === 'main' ? !['skipped', 'dismissed'].includes(x.status) : x.status === tab);
  const cnt = (k: string) => inBox.filter((x) => k === 'main' ? !['skipped', 'dismissed'].includes(x.status) && !x.read_at : x.status === k).length;
  return <>
    <div className="hero"><h1>דואר <span className="mark">נכנס</span></h1>
      <p>כל מייל חדש שמגיע לתיבות המחוברות. איריס קוראת אותו, משייכת ללקוח ופותחת משימת מעקב כשצריך. אפשר לקרוא ולענות מכאן, וכל תשובה נשלחת רק כשאתה לוחץ "שליחה".
        {boxes.length ? ` תיבות מחוברות: ${boxes.join(' · ')}.` : ' התיבה תתחבר בדקות הקרובות.'} מוצגים רק מיילים שהגיעו מרגע החיבור.</p></div>
    {boxes.length > 1 && <div className="tabs ib-boxes"><button className={!mb ? 'on' : ''} onClick={() => setMb('')}>כל התיבות</button>{boxes.map((b) => <button key={b} className={mb === b ? 'on' : ''} onClick={() => setMb(b)} dir="ltr">{b}</button>)}</div>}
    <div className="acc-bar"><div className="tabs" style={{ margin: 0 }}>{TABS.map(([k, l]) => { const c = cnt(k); return <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{c ? ` (${c})` : ''}</button>; })}</div></div>
    {msg && <p className="small acc-msg">{msg}</p>}
    <div className="ib-list">{shown.map((x) => { const [sl, st] = ST[x.status] ?? [x.status, 'muted']; const sel = pick[x.id] ?? x.suggested_client ?? '';
      return <div key={x.id} className={`card ib ${x.kind === 'complaint' ? 'hot' : ''} ${!x.read_at && x.status !== 'skipped' ? 'unread' : ''}`}>
        <button className="ib-h" onClick={() => setOpen(x.id)}><div className="sp"><b>{x.subject || '(ללא נושא)'}</b><small>{x.from_name ? `${x.from_name} · ` : ''}<span dir="ltr">{x.from_email}</span> · {ago(x.received_at)}{boxes.length > 1 ? <> · אל <span dir="ltr">{short(x.mailbox)}</span></> : null}{x.att ? ` · 📎${x.att}` : ''}</small></div>
          {x.replied_at && <span className="badge ok">נענה</span>}{x.kind && x.status !== 'skipped' && <span className="badge">{KIND[x.kind] ?? x.kind}</span>}<span className={`badge ${st}`}>{sl}</span></button>
        {(x.summary || x.snippet) && <p className="ib-sum" onClick={() => setOpen(x.id)}>{x.summary || x.snippet}</p>}
        {x.status !== 'skipped' && <div className="ib-f">
          {x.client ? <Link href={`/clients/${x.client_id}`} className="badge cyan">{x.client}{x.match_by ? ` · ${BY[x.match_by] ?? x.match_by}` : ''}</Link>
            : x.status !== 'info' && x.status !== 'dismissed' && <>
              <select value={sel} onChange={(e) => setPick({ ...pick, [x.id]: e.target.value })} aria-label="לקוח"><option value="">בחר לקוח…</option>{(d.clients ?? []).map((k: any) => <option key={k.id} value={k.id}>{k.name}{k.id === x.suggested_client ? ' (הצעה)' : ''}</option>)}</select>
              <button className="btn sm y" disabled={!sel || !!busy} onClick={() => run(x.id, 'inbox_assign', { client_id: sel })}>שייך</button>
              <button className="btn sm" disabled={!!busy} onClick={() => run(x.id, 'inbox_lead')}>צור ליד</button></>}
          {x.todo_title && <span className="small ib-todo">✓ משימה: {x.todo_title}{x.todo_status !== 'open' ? ` (${x.todo_status === 'done' ? 'בוצעה' : 'בוטלה'})` : ''}</span>}
          <span className="sp" /><button className="btn sm" onClick={() => setOpen(x.id)}>פתיחה ומענה</button>
          {x.status !== 'dismissed' && <button className="btn sm ghost" disabled={!!busy} onClick={() => run(x.id, 'inbox_dismiss')}>לא רלוונטי</button>}
        </div>}</div>; })}
      {!shown.length && <p className="muted">{items.length ? 'אין מיילים בתצוגה הזו.' : 'עוד לא הגיעו מיילים חדשים מאז החיבור.'}</p>}</div>
    {open && <Reader id={open} onClose={() => { setOpen(null); r.refresh(); }} />}
  </>;
}

function Reader({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  const [to, setTo] = useState(''); const [cc, setCc] = useState(''); const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(''); const [note, setNote] = useState<{ ok: boolean; t: string } | null>(null); const [reply, setReply] = useState(false);
  useEffect(() => { callRpc('office_inbox_email', { p_id: id }).then((x) => { setD(x); const e = x.email; setTo(e.from_email ?? ''); setSubject(/^(re|תגובה)\s*:/i.test(e.subject ?? '') ? e.subject : `Re: ${e.subject ?? ''}`); }).catch((e) => setErr(heError(e))); }, [id]);
  const e = d?.email;
  const draft = async () => { setBusy('draft'); setNote(null); try { const r = await fetch(`/api/inbox/${id}/draft`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hint }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setBody(j.text); setReply(true); } catch (x: any) { setNote({ ok: false, t: x.message }); } finally { setBusy(''); } };
  const send = async () => {
    if (!window.confirm(`לשלוח את התשובה ל-${to}${cc ? ` (העתק: ${cc})` : ''} מהתיבה ${e.mailbox}?`)) return;
    setBusy('send'); setNote(null);
    try { const r = await fetch(`/api/inbox/${id}/reply`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to, cc, subject, body }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setNote({ ok: true, t: 'התשובה נשלחה ✓' }); setReply(false); setBody(''); setD(await callRpc('office_inbox_email', { p_id: id })); }
    catch (x: any) { setNote({ ok: false, t: x.message }); } finally { setBusy(''); }
  };
  const gmail = e ? `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(e.mailbox)}#search/rfc822msgid%3A${encodeURIComponent(String(e.message_id).replace(/[<>]/g, ''))}` : '#';
  return <Modal open onClose={onClose} label="מייל">
    {err ? <p className="err">{err}</p> : !e ? <p className="muted">טוען…</p> : <div className="rd">
      <div className="row"><h2 className="sp">{e.subject || '(ללא נושא)'}</h2><button className="btn sm ghost" onClick={onClose}>סגירה</button></div>
      <p className="small rd-meta"><b>{e.from_name || e.from_email}</b> <span dir="ltr">&lt;{e.from_email}&gt;</span> · {fmtDateTime(e.received_at)}<br />אל: <span dir="ltr">{e.to_list || e.mailbox}</span>{e.cc_list ? <> · העתק: <span dir="ltr">{e.cc_list}</span></> : null}{d.client ? <> · לקוח: <b>{d.client}</b></> : null}</p>
      {e.summary && <p className="rd-sum">✨ {e.summary}</p>}
      {(d.thread ?? []).length > 0 && <details className="rd-thread"><summary className="small">התכתבות קודמת בשרשור ({d.thread.length})</summary>{d.thread.map((t: any) => <div key={t.id} className={`rd-t ${t.direction}`}><small>{t.direction === 'out' ? 'נשלח מאיתנו' : t.from_name || t.from_email} · {fmtDateTime(t.received_at)}</small><pre>{t.body_text}</pre></div>)}</details>}
      <pre className="rd-body">{e.body_text || e.snippet || '(אין תוכן טקסט. פתח ב-Gmail לצפייה מלאה)'}</pre>
      {(e.attachments ?? []).length > 0 && <p className="small">📎 {(e.attachments as any[]).map((a) => a.name).filter(Boolean).join(' · ')} <a href={gmail} target="_blank" rel="noreferrer">(פתיחת הקבצים ב-Gmail)</a></p>}
      <div className="rd-act"><button className="btn y" onClick={() => setReply(true)}>תשובה</button><a className="btn ghost" href={gmail} target="_blank" rel="noreferrer">פתיחה ב-Gmail ↗</a></div>
      {reply && <div className="rd-reply">
        <label>אל<input dir="ltr" value={to} onChange={(x) => setTo(x.target.value)} /></label>
        <label>העתק (לא חובה)<input dir="ltr" value={cc} onChange={(x) => setCc(x.target.value)} placeholder="a@b.co.il, c@d.com" /></label>
        <label>נושא<input value={subject} onChange={(x) => setSubject(x.target.value)} /></label>
        <div className="rd-ai"><input value={hint} onChange={(x) => setHint(x.target.value)} placeholder="הנחיה לאיריס (לא חובה), למשל: לאשר ולהגיד שנחזור עד יום ראשון" /><button className="btn sm" disabled={!!busy} onClick={draft}>{busy === 'draft' ? 'כותבת…' : '✨ טיוטה עם איריס'}</button></div>
        <label>תוכן<textarea rows={9} value={body} onChange={(x) => setBody(x.target.value)} /></label>
        <div className="rd-act"><button className="btn y" disabled={!!busy || !body.trim() || !to.trim()} onClick={send}>{busy === 'send' ? 'שולח…' : 'שליחה'}</button><span className="small muted">נשלח מ-<span dir="ltr">{e.mailbox}</span> בתוך אותו שרשור</span></div>
      </div>}
      {note && <p className={`small ${note.ok ? 'ok-t' : 'err'}`}>{note.t}</p>}
    </div>}
  </Modal>;
}
