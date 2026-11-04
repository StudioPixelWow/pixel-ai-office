'use client';
import { useMemo, useState } from 'react';
const TZ = 'Asia/Jerusalem';
const dkey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
const fd = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, ...o }).format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));
const NET: Record<string, string> = { facebook: 'פייסבוק', instagram: 'אינסטגרם', tiktok: 'טיקטוק', linkedin: 'לינקדאין', youtube: 'יוטיוב' };
type P = { id: string; topic: string; due: string; platforms?: string[]; format?: string; marker?: string | null; kind?: string; cs?: string | null; st: 'prep' | 'ready' | 'published'; text?: string | null; hashtags?: string[] | null; img?: string | null; url?: string | null; note?: string | null };
// Year content plan for the client: month tabs, a calendar per month, every planned post; open a post to approve it or leave a note.
export function PortalGantt({ plan, img, act, busy }: { plan: P[]; img: (id: string) => string; act: (op: string, id: string | null, note?: string) => Promise<boolean>; busy: string | null }) {
  const [local, setLocal] = useState<Record<string, string>>({});
  const stOf = (p: P) => local[p.id] ?? (p.st === 'published' ? 'published' : p.cs === 'approved' ? 'approved' : p.cs === 'changes' ? 'changes' : p.cs === 'sent' ? 'waiting' : p.st === 'ready' ? 'ready' : 'prep');
  const now = dkey(new Date().toISOString()).slice(0, 7); const year = Number(now.slice(0, 4));
  const months = useMemo(() => { const s = new Set<string>(Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)); plan.forEach((p) => s.add(dkey(p.due).slice(0, 7))); return [...s].sort(); }, [plan, year]);
  const [mo, setMo] = useState(months.includes(now) ? now : months[0]); const [open, setOpen] = useState<P | null>(null); const [note, setNote] = useState(''); const [writing, setWriting] = useState(false);
  const its = plan.filter((p) => dkey(p.due).slice(0, 7) === mo);
  const waiting = its.filter((p) => stOf(p) === 'waiting');
  const [yy, mm] = mo.split('-').map(Number); const first = new Date(Date.UTC(yy, mm - 1, 1)); const nd = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((first.getUTCDay() + nd) / 7) * 7 }, (_, k) => { const d = k - first.getUTCDay() + 1; return d >= 1 && d <= nd ? `${mo}-${String(d).padStart(2, '0')}` : null; });
  const LBL: Record<string, string> = { prep: 'בהכנה', ready: 'מוכן', waiting: 'מחכה לאישורכם', approved: 'אישרתם ✓', changes: 'בתיקון לפי ההערה', published: 'עלה ✓' };
  const count = (m: string) => plan.filter((p) => dkey(p.due).slice(0, 7) === m).length;
  const doAct = async (op: string, p: P | null, text = '') => { const ok = await act(op, p?.id ?? null, text); if (ok) {
    if (op === 'approve_all') setLocal((x) => ({ ...x, ...Object.fromEntries(waiting.map((w) => [w.id, 'approved'])) }));
    else if (p) setLocal((x) => ({ ...x, [p.id]: op === 'approve' ? 'approved' : 'changes' }));
    setWriting(false); setNote(''); if (op !== 'approve_all') setOpen(null); } };
  return <div className="pg">
    <div className="pg-months" role="tablist">{months.map((m) => <button key={m} role="tab" aria-selected={m === mo} className={`${m === mo ? 'on' : ''} ${m < now ? 'past' : ''}`} onClick={() => setMo(m)}>
      <b>{fd(`${m}-01`, { month: 'short' })}</b><small>{count(m) ? `${count(m)} פוסטים` : '—'}</small></button>)}</div>
    <div className="pg-head"><div><h3>{fd(`${mo}-01`, { month: 'long', year: 'numeric' })}</h3>
      <span>{its.length ? `${its.length} פוסטים מתוכננים · ${its.filter((p) => ['approved', 'published'].includes(stOf(p))).length} מאושרים` : 'עוד לא תוכנן תוכן לחודש הזה'}</span></div>
      {waiting.length > 0 && <button className="pt-btn y" disabled={!!busy} onClick={() => doAct('approve_all', null)}>✓ אישור כל החודש ({waiting.length})</button>}</div>
    {its.length > 0 && <div className="pg-legend">{['waiting', 'approved', 'prep', 'changes', 'published'].map((k) => <i key={k} className={`pg-dot ${k}`}>{LBL[k]}</i>)}</div>}
    <div className="pg-cal">{['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'].map((x) => <div key={x} className="pg-dow">{x}</div>)}
      {cells.map((day, k) => { const dp = day ? its.filter((p) => dkey(p.due) === day) : [];
        return <div key={k} className={`pg-cell ${day ? '' : 'off'} ${day && day === dkey(new Date().toISOString()) ? 'today' : ''}`}>{day && <small>{Number(day.slice(8))}</small>}
          {dp.map((p) => <button key={p.id} className={`pg-post ${stOf(p)}`} onClick={() => { setOpen(p); setWriting(false); setNote(''); }}>
            {p.img ? <img src={img(p.img)} alt="" loading="lazy" /> : null}<span>{p.marker ? '✡ ' : ''}{p.topic}</span><em>{LBL[stOf(p)]}</em></button>)}</div>; })}</div>
    <div className="pg-list">{its.map((p) => <button key={p.id} className={`pg-row ${stOf(p)}`} onClick={() => { setOpen(p); setWriting(false); setNote(''); }}>
      <b>{fd(p.due, { weekday: 'short', day: 'numeric', month: 'numeric' })}</b><span>{p.marker ? '✡ ' : ''}{p.topic}</span><em>{LBL[stOf(p)]}</em></button>)}</div>
    {open && <div className="pg-back" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
      <article className="pg-modal">
        <div className="pg-mh"><div><small>{fd(open.due, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}{(open.platforms ?? []).length ? ` · ${(open.platforms ?? []).map((n) => NET[n] ?? n).join(' · ')}` : ''}{open.format ? ` · ${open.format}` : ''}</small>
          <h3>{open.topic}</h3>{open.marker && <span className="pg-tag">✡ {open.marker}</span>}</div><button className="pt-btn ghost" onClick={() => setOpen(null)} aria-label="סגירה">✕</button></div>
        {open.img && <img className="pg-img" src={img(open.img)} alt="" />}
        {open.text ? <p className="pg-text">{open.text}</p> : <p className="pg-prep">הפוסט בהכנה אצל הצוות. הטקסט והעיצוב יופיעו כאן כשיהיו מוכנים. כבר עכשיו אפשר לכתוב לנו מה חשוב לכם שייכנס אליו.</p>}
        {(open.hashtags ?? []).length > 0 && <p className="pg-tags" dir="auto">{(open.hashtags ?? []).join(' ')}</p>}
        {open.url && <a className="pt-btn ghost" href={open.url} target="_blank" rel="noreferrer">צפייה בפוסט שעלה ↗</a>}
        <div className="pg-st"><i className={`pg-dot ${stOf(open)}`}>{LBL[stOf(open)]}</i></div>
        {stOf(open) !== 'published' && (writing
          ? <div className="pt-ch"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} autoFocus placeholder="מה תרצו לשנות או להוסיף? (טקסט, תמונה, מסר, תאריך…)" />
            <div className="pt-btns"><button className="pt-btn y" disabled={!!busy || !note.trim()} onClick={() => doAct('changes', open, note)}>{busy ? 'שולח…' : 'שליחת ההערה'}</button><button className="pt-btn ghost" onClick={() => setWriting(false)}>ביטול</button></div></div>
          : <div className="pt-btns">{stOf(open) === 'waiting' && <button className="pt-btn y" disabled={!!busy} onClick={() => doAct('approve', open)}>מאשר/ת ✓</button>}
            <button className="pt-btn ghost" onClick={() => setWriting(true)}>💬 הערה על הפוסט</button></div>)}
      </article></div>}
  </div>;
}
