'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Msg = { role: 'user' | 'assistant'; text: string; task?: any; href?: string | null; done?: string | null };
const KEY = 'pixi-chat-v1';
const SUGGEST = ['מה מחכה לי היום?', 'תכין גאנט לחודש הבא לכל הלקוחות', 'מה תקוע השבוע?', 'פתח ליד חדש', 'כמה נכנס החודש?'];

export function Assistant() {
  const path = usePathname(); const r = useRouter();
  const [open, setOpen] = useState(false); const [msgs, setMsgs] = useState<Msg[]>([]); const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null); const inp = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { try { const s = sessionStorage.getItem(KEY); if (s) setMsgs(JSON.parse(s)); } catch { /* storage off */ } }, []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-30))); } catch { /* storage off */ } end.current?.scrollIntoView({ block: 'end' }); }, [msgs]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setOpen((o) => !o); } if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  useEffect(() => { if (open) setTimeout(() => inp.current?.focus(), 50); }, [open]);
  useEffect(() => { const h = (e: Event) => { const q = String((e as CustomEvent).detail ?? ''); setOpen(true); if (q) setTimeout(() => sendRef.current?.(q), 30); };
    window.addEventListener('pixi:ask', h); return () => window.removeEventListener('pixi:ask', h); }, []);
  const sendRef = useRef<((q?: string) => void) | null>(null);
  if (path?.startsWith('/c/') || path?.startsWith('/podcast') || path?.startsWith('/pay') || path?.startsWith('/login')) return null;

  const send = async (q?: string) => {
    const t = (q ?? text).trim(); if (!t || busy) return; setText('');
    const next: Msg[] = [...msgs, { role: 'user', text: t }]; setMsgs(next); setBusy(true);
    const j = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, text: m.text })), page: path }) }).then((x) => x.json()).catch(() => ({ error: 'אין חיבור' }));
    setBusy(false);
    if (j.error) { setMsgs([...next, { role: 'assistant', text: `לא הצלחתי: ${j.error}` }]); return; }
    const m: Msg = { role: 'assistant', text: j.reply ?? '', href: j.type === 'navigate' ? j.href : null, task: j.type === 'task' ? { ...j.task, key: crypto.randomUUID() } : null };
    setMsgs([...next, m]);
    if (j.type === 'navigate' && j.href) r.push(j.href);
  };
  sendRef.current = send;
  const confirm = async (i: number) => {
    const m = msgs[i]; if (!m.task) return; setBusy(true);
    const j = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: m.task }) }).then((x) => x.json()).catch(() => ({ error: 'אין חיבור' }));
    setBusy(false);
    setMsgs(msgs.map((x, k) => k === i ? { ...x, done: j.error ? `שגיאה: ${j.error}` : (j.request_id ? `/room/${j.request_id}` : '/talk') } : x));
  };

  return <>
    <button className={`px-fab ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-label="פיקסי — העוזר החכם" title="פיקסי (Ctrl/⌘ J)"><span>✦</span><b>פיקסי</b></button>
    {open && <div className="px-scrim" onClick={() => setOpen(false)} />}
    <aside className={`px-panel ${open ? 'open' : ''}`} aria-hidden={!open} role="dialog" aria-label="פיקסי">
      <header><div><b>✦ פיקסי</b><small>שואלים, מנווטים, או שולחים משימה לסוכנים — בטקסט חופשי</small></div>
        <div className="px-h-a">{msgs.length > 0 && <button onClick={() => setMsgs([])} title="שיחה חדשה">↺</button>}<button onClick={() => setOpen(false)} aria-label="סגירה">✕</button></div></header>
      <div className="px-body">
        {!msgs.length && <div className="px-hello"><p>היי טל 👋 מה צריך?</p><div className="px-sug">{SUGGEST.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}</div></div>}
        {msgs.map((m, i) => <div key={i} className={`px-m ${m.role}`}>
          {m.text && <p>{m.text}</p>}
          {m.href && <a className="px-link" href={m.href} onClick={(e) => { e.preventDefault(); r.push(m.href!); setOpen(false); }}>פתיחה ←</a>}
          {m.task && <div className="px-task"><small>משימה לסוכנים{m.task.all_clients ? ' · כל הלקוחות הפעילים' : m.task.client_name ? ` · ${m.task.client_name}` : ' · הקשר כללי'}</small><p>{m.task.text}</p>
            {m.done ? (m.done.startsWith('/') ? <a className="px-link" href={m.done} onClick={(e) => { e.preventDefault(); r.push(m.done!); setOpen(false); }}>✓ נשלח — לחדר העבודה ←</a> : <span className="px-err">{m.done}</span>)
              : <div className="px-task-a"><button className="btn y sm" disabled={busy} onClick={() => confirm(i)}>שלח לסוכנים</button><button className="btn sm ghost" onClick={() => { setText(m.task.text); inp.current?.focus(); }}>לערוך</button></div>}</div>}
        </div>)}
        {busy && <div className="px-m assistant"><p className="px-dots"><i /><i /><i /></p></div>}
        <div ref={end} />
      </div>
      <form className="px-in" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea ref={inp} rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="כתוב לפיקסי… (Enter לשליחה)" />
        <button className="btn y" disabled={busy || !text.trim()} aria-label="שליחה">↑</button>
      </form>
    </aside>
  </>;
}
