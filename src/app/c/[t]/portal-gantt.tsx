'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
const TZ = 'Asia/Jerusalem';
const dkey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
const fd = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, ...o }).format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));
const NET: Record<string, string> = { facebook: 'פייסבוק', instagram: 'אינסטגרם', tiktok: 'טיקטוק', linkedin: 'לינקדאין', youtube: 'יוטיוב' };
const NET_S: Record<string, string> = { facebook: 'f', instagram: 'IG', tiktok: 'TT', linkedin: 'in', youtube: 'YT' };
const fmtIcon = (f?: string) => /רילס|וידאו|סרטון/.test(f ?? '') ? '▶' : /קרוסלה/.test(f ?? '') ? '▦' : /סטורי/.test(f ?? '') ? '◉' : '❝';
type P = { id: string; topic: string; due: string; platforms?: string[]; format?: string; marker?: string | null; kind?: string; cs?: string | null; st: 'prep' | 'ready' | 'published'; text?: string | null; hashtags?: string[] | null; img?: string | null; url?: string | null; note?: string | null };
const LBL: Record<string, string> = { prep: 'בהכנה', ready: 'מוכן', waiting: 'מחכה לאישורכם', approved: 'אישרתם', changes: 'בתיקון', published: 'עלה לרשתות' };
const DOW = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// The client's content plan: hero with the month's numbers, month strip, full-width calendar, social-style post preview with approve / note.
export function PortalGantt({ client, plan, img, act, busy }: { client: { name: string }; plan: P[]; img: (id: string) => string; act: (op: string, id: string | null, note?: string) => Promise<boolean>; busy: string | null }) {
  const [local, setLocal] = useState<Record<string, string>>({});
  const stOf = (p: P) => local[p.id] ?? (p.st === 'published' ? 'published' : p.cs === 'approved' ? 'approved' : p.cs === 'changes' ? 'changes' : p.cs === 'sent' ? 'waiting' : p.st === 'ready' ? 'ready' : 'prep');
  const today = dkey(new Date().toISOString()); const now = today.slice(0, 7);
  const months = useMemo(() => { const s = new Set<string>(Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(Number(now.slice(0, 4)), Number(now.slice(5, 7)) - 1 + i, 1)); return d.toISOString().slice(0, 7); }));
    plan.forEach((p) => s.add(dkey(p.due).slice(0, 7))); return [...s].sort(); }, [plan, now]);
  const [mo, setMo] = useState(months.includes(now) ? now : months[0]); const [open, setOpen] = useState<P | null>(null); const [note, setNote] = useState(''); const [writing, setWriting] = useState(false);
  const [general, setGeneral] = useState(false); const [gnote, setGnote] = useState('');
  const tabs = useRef<HTMLDivElement>(null);
  useEffect(() => { tabs.current?.querySelector<HTMLElement>('.on')?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [mo]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  const its = plan.filter((p) => dkey(p.due).slice(0, 7) === mo);
  const waiting = its.filter((p) => stOf(p) === 'waiting'); const approved = its.filter((p) => ['approved', 'published'].includes(stOf(p)));
  const next = plan.filter((p) => dkey(p.due) >= today && stOf(p) !== 'published')[0];
  const [yy, mm] = mo.split('-').map(Number); const first = new Date(Date.UTC(yy, mm - 1, 1)); const nd = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((first.getUTCDay() + nd) / 7) * 7 }, (_, k) => { const d = k - first.getUTCDay() + 1; return d >= 1 && d <= nd ? `${mo}-${String(d).padStart(2, '0')}` : null; });
  const count = (m: string) => plan.filter((p) => dkey(p.due).slice(0, 7) === m).length;
  const pct = its.length ? Math.round((approved.length / its.length) * 100) : 0;
  const doAct = async (op: string, p: P | null, text = '') => { const ok = await act(op, p?.id ?? null, text); if (ok) {
    if (op === 'approve_all') setLocal((x) => ({ ...x, ...Object.fromEntries(waiting.map((w) => [w.id, 'approved'])) }));
    else if (p) setLocal((x) => ({ ...x, [p.id]: op === 'approve' ? 'approved' : 'changes' }));
    setWriting(false); setNote(''); if (p) setOpen(null); } };
  const thumb = (p: P, big = false) => p.img ? <img src={img(p.img)} alt="" loading="lazy" /> : <span className={`pgx-ph ${big ? 'big' : ''}`}><i>{fmtIcon(p.format)}</i>{big && <small>{p.st === 'prep' ? 'העיצוב בהכנה' : p.format ?? 'פוסט'}</small>}</span>;

  return <div className="pgx">
    <header className="pgx-hero">
      <div className="pgx-top"><img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-white-500.webp" alt="Pixel Digital" /><span className="pgx-av">{client.name.slice(0, 1)}</span></div>
      <div className="pgx-title"><small>גאנט התוכן · {fd(`${mo}-01`, { month: 'long', year: 'numeric' })}</small><h1>{client.name}</h1>
        <p>כל התוכן שאנחנו מתכננים לכם. לחצו על פוסט כדי לראות אותו, לאשר או לכתוב לנו הערה.</p></div>
      <div className="pgx-kpis">
        <div><b>{its.length}</b><span>פוסטים בחודש</span></div>
        <div className={waiting.length ? 'hot' : ''}><b>{waiting.length}</b><span>מחכים לאישורכם</span></div>
        <div><b>{approved.length}</b><span>אושרו</span><i style={{ width: `${pct}%` }} /></div>
        <div><b>{next ? fd(next.due, { day: 'numeric', month: 'numeric' }) : '—'}</b><span>{next ? `הפוסט הבא · יום ${fd(next.due, { weekday: 'long' }).replace('יום ', '')}` : 'אין פוסטים קרובים'}</span></div>
      </div>
      <div className="pgx-months" ref={tabs} role="tablist">{months.map((m) => <button key={m} role="tab" aria-selected={m === mo} className={`${m === mo ? 'on' : ''} ${count(m) ? 'has' : ''}`} onClick={() => setMo(m)}>
        <b>{fd(`${m}-01`, { month: 'long' })}</b><small>{count(m) ? `${count(m)} פוסטים` : 'עוד לא תוכנן'}</small></button>)}</div>
    </header>

    <section className="pgx-body">
      <div className="pgx-bar"><div className="pgx-legend">{['waiting', 'approved', 'prep', 'changes', 'published'].map((k) => <span key={k} className={`pgx-chip s-${k}`}>{LBL[k]}</span>)}</div>
        <button className="pgx-gbtn" onClick={() => setGeneral(true)}>💬 הערה כללית על התוכן</button></div>
      {its.length === 0 ? <div className="pgx-empty"><b>עוד לא תכננו את {fd(`${mo}-01`, { month: 'long' })}</b><span>כשהתוכנית תהיה מוכנה, הפוסטים יופיעו כאן.</span></div> : <>
      <div className="pgx-cal">{DOW.map((x) => <div key={x} className="pgx-dow">{x}</div>)}
        {cells.map((day, k) => { const dp = day ? its.filter((p) => dkey(p.due) === day) : [];
          return <div key={k} className={`pgx-cell ${day ? '' : 'off'} ${day === today ? 'today' : ''} ${dp.length ? 'full' : ''} ${day && day < today ? 'past' : ''}`}>
            {day && <span className="pgx-dn">{Number(day.slice(8))}</span>}
            {dp.map((p) => <button key={p.id} className={`pgx-card s-${stOf(p)}`} onClick={() => { setOpen(p); setWriting(false); setNote(''); }}>
              <span className="pgx-th">{thumb(p)}</span>
              <span className="pgx-ct"><b>{p.marker ? '✡ ' : ''}{p.topic}</b>
                <span className="pgx-meta"><em className={`pgx-chip s-${stOf(p)}`}>{LBL[stOf(p)]}</em>{(p.platforms ?? []).map((n) => <i key={n}>{NET_S[n] ?? n}</i>)}</span></span></button>)}
          </div>; })}</div>
      <div className="pgx-list">{its.map((p) => <button key={p.id} className={`pgx-row s-${stOf(p)}`} onClick={() => { setOpen(p); setWriting(false); setNote(''); }}>
        <span className="pgx-date"><b>{fd(p.due, { day: 'numeric' })}</b><small>{fd(p.due, { weekday: 'short' })}</small></span>
        <span className="pgx-th">{thumb(p)}</span>
        <span className="pgx-ct"><b>{p.marker ? '✡ ' : ''}{p.topic}</b><span className="pgx-meta"><em className={`pgx-chip s-${stOf(p)}`}>{LBL[stOf(p)]}</em>{p.format && <i>{p.format}</i>}</span></span></button>)}</div></>}
    </section>

    {waiting.length > 0 && <div className="pgx-sticky"><span><b>{waiting.length}</b> פוסטים ב{fd(`${mo}-01`, { month: 'long' })} מחכים לאישורכם</span>
      <button disabled={!!busy} onClick={() => doAct('approve_all', null)}>{busy === 'approve_all' ? 'מאשר…' : '✓ אישור כל החודש'}</button></div>}

    {open && <div className="pgx-back" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
      <div className="pgx-modal">
        <button className="pgx-x" onClick={() => setOpen(null)} aria-label="סגירה">✕</button>
        <div className="pgx-phone">
          <div className="pgx-ph-h"><span className="pgx-av sm">{client.name.slice(0, 1)}</span><div><b>{client.name}</b><small>{(open.platforms ?? []).map((n) => NET[n] ?? n).join(' · ') || 'רשתות חברתיות'}</small></div></div>
          <div className={`pgx-ph-img ${/סטורי|רילס/.test(open.format ?? '') ? 'tall' : ''}`}>{thumb(open, true)}</div>
          <div className="pgx-ph-t">{open.text ? <p>{open.text}</p> : <p className="muted">הטקסט בכתיבה אצל הצוות ויופיע כאן כשיהיה מוכן.</p>}
            {(open.hashtags ?? []).length > 0 && <p className="pgx-tags" dir="auto">{(open.hashtags ?? []).join(' ')}</p>}</div>
        </div>
        <aside className="pgx-side">
          <small className="pgx-when">{fd(open.due, { weekday: 'long', day: 'numeric', month: 'long' })} · {fd(open.due, { hour: '2-digit', minute: '2-digit' })}</small>
          <h2>{open.topic}</h2>
          <div className="pgx-facts">{open.marker && <span className="pgx-chip s-hol">✡ {open.marker}</span>}{open.format && <span className="pgx-chip s-fmt">{fmtIcon(open.format)} {open.format}</span>}<span className={`pgx-chip s-${stOf(open)}`}>{LBL[stOf(open)]}</span></div>
          {stOf(open) === 'prep' && <p className="pgx-note">הפוסט עדיין בהכנה. אפשר כבר עכשיו לכתוב לנו מה חשוב לכם שייכנס אליו.</p>}
          {stOf(open) === 'changes' && <p className="pgx-note">קיבלנו את ההערה שלכם ואנחנו מעדכנים את הפוסט.</p>}
          {open.url && <a className="pgx-link" href={open.url} target="_blank" rel="noreferrer">צפייה בפוסט שעלה ↗</a>}
          {stOf(open) !== 'published' && (writing
            ? <div className="pgx-write"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} autoFocus placeholder="מה תרצו לשנות או להוסיף? טקסט, תמונה, מסר, תאריך…" />
              <div className="pgx-acts"><button className="pgx-btn y" disabled={!!busy || !note.trim()} onClick={() => doAct('changes', open, note)}>{busy ? 'שולח…' : 'שליחת ההערה'}</button><button className="pgx-btn" onClick={() => setWriting(false)}>ביטול</button></div></div>
            : <div className="pgx-acts">{stOf(open) === 'waiting' && <button className="pgx-btn y" disabled={!!busy} onClick={() => doAct('approve', open)}>✓ מאשר/ת את הפוסט</button>}
              <button className="pgx-btn" onClick={() => setWriting(true)}>💬 הערה על הפוסט</button></div>)}
        </aside>
      </div></div>}

    {general && <div className="pgx-back" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setGeneral(false); }}>
      <div className="pgx-modal small"><button className="pgx-x" onClick={() => setGeneral(false)} aria-label="סגירה">✕</button>
        <aside className="pgx-side"><small className="pgx-when">הערה כללית</small><h2>מה חשוב לכם בתוכן?</h2>
          <p className="pgx-note">מבצעים, אירועים, מסרים, דברים שלא לכתוב. אנחנו מכניסים את זה לתכנון של החודשים הבאים.</p>
          <textarea value={gnote} onChange={(e) => setGnote(e.target.value)} rows={6} autoFocus />
          <div className="pgx-acts"><button className="pgx-btn y" disabled={!!busy || !gnote.trim()} onClick={async () => { if (await act('month_note', null, gnote)) { setGnote(''); setGeneral(false); } }}>{busy ? 'שולח…' : 'שליחה'}</button></div></aside></div></div>}
  </div>;
}
