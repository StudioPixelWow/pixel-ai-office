'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';
import { Sheet } from '@/components/sheet';

const TZ = 'Asia/Jerusalem';
const key = (d: Date | string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d));
const f = (d: string | Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, ...o }).format(new Date(d));
const time = (d: string) => f(d, { hour: '2-digit', minute: '2-digit' });
const TYPE: Record<string, [string, string]> = { holiday: ['חגים ומועדים', '✡'], meeting: ['פגישה', '●'], loud: ['הקלטת LOUD', '🎙'], todo: ['משימה', '☐'], milestone: ['אבן דרך', '◆'], post: ['פוסט', '▦'] };
const DOW = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
function tzOff(date: string) { const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' }).formatToParts(new Date(`${date}T12:00:00Z`)).find((x) => x.type === 'timeZoneName')?.value ?? 'GMT+2'; const h = Number(p.match(/GMT([+-]\d+)/)?.[1] ?? 2); return `${h >= 0 ? '+' : '-'}${String(Math.abs(h)).padStart(2, '0')}:00`; }
const iso = (date: string, t: string) => new Date(`${date}T${t}:00${tzOff(date)}`).toISOString();

export function CalendarView({ anchor, view, items, google, gAccounts = [], gConfigured, gFlash, feed, clients, canConnect, leads = [] }:
  { anchor: string; view: 'month' | 'week' | 'agenda'; items: any[]; google: any; gAccounts?: any[]; gConfigured: boolean; gFlash: string | null; feed: string | null; clients: { id: string; name: string }[]; canConnect: boolean; leads?: { id: string; name: string }[] }) {
  const r = useRouter(); const [show, setShow] = useState<Record<string, boolean>>({ holiday: true, meeting: true, loud: true, todo: true, milestone: true, post: false });
  const [edit, setEdit] = useState<any | null>(null); const [peek, setPeek] = useState<any | null>(null); const [gPanel, setGPanel] = useState(!!gFlash); const [copied, setCopied] = useState(false); const [syncing, setSyncing] = useState(false); const [sel, setSel] = useState<string | null>(null);
  const vis = items.filter((x) => show[x.type]);
  const byDay = useMemo(() => { const m = new Map<string, any[]>(); for (const x of vis) { const k = key(x.start); m.set(k, [...(m.get(k) ?? []), x]); } return m; }, [vis]);
  const a = new Date(`${anchor}T12:00:00Z`);
  const go = (d: Date, v = view) => r.push(`/calendar?d=${key(d)}&v=${v}`);
  const shift = (n: number) => { const d = new Date(a); if (view === 'month') d.setUTCMonth(d.getUTCMonth() + n, 1); else d.setUTCDate(d.getUTCDate() + 7 * n); go(d); };
  const days = useMemo(() => { const s = new Date(a); if (view === 'month') { s.setUTCDate(1); } s.setUTCDate(s.getUTCDate() - s.getUTCDay()); const n = view === 'month' ? 42 : 7; return Array.from({ length: n }, (_, i) => { const d = new Date(s); d.setUTCDate(s.getUTCDate() + i); return d; }); }, [anchor, view]);
  const today = key(new Date()); const counts = { overdue: items.filter((x) => x.overdue).length, today: (byDay.get(today) ?? []).length };
  const newItem = (date: string, type: 'meeting' | 'todo' = 'meeting') => setEdit({ type, title: '', date, time: '10:00', end: '11:00', client_id: '', location: '', description: '', all_day: type === 'todo' });

  return <div className="cal">
    <section className="cal-head">
      <div><h1>יומן</h1><p className="muted">פגישות, משימות, אבני דרך, הקלטות ופוסטים · {counts.today} היום{counts.overdue ? ` · ${counts.overdue} באיחור` : ''}</p></div>
      <div className="cal-head-a">
        <button className="btn y" onClick={() => newItem(today, 'meeting')}>＋ פגישה</button>
        <button className="btn" onClick={() => newItem(today, 'todo')}>＋ משימה</button>
        <button className={`btn ${google ? 'ghost' : 'c'}`} onClick={() => setGPanel(true)}>{gAccounts.length ? `✓ Google · ${gAccounts.length > 1 ? `${gAccounts.length} יומנים` : gAccounts[0].account}` : 'חיבור Google Calendar'}</button>
      </div>
    </section>
    <div className="cal-bar">
      <div className="cal-nav"><button className="btn sm ghost" onClick={() => shift(-1)} aria-label="הקודם">→</button><button className="btn sm ghost" onClick={() => go(new Date())}>היום</button><button className="btn sm ghost" onClick={() => shift(1)} aria-label="הבא">←</button>
        <b>{view === 'month' ? f(a, { month: 'long', year: 'numeric' }) : `${f(days[0], { day: 'numeric', month: 'short' })} – ${f(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`}</b></div>
      <div className="cal-filters">{Object.entries(TYPE).map(([k, [l, i]]) => <button key={k} className={`cal-f t-${k}${show[k] ? ' on' : ''}`} onClick={() => setShow({ ...show, [k]: !show[k] })}><i>{i}</i>{l}</button>)}</div>
      <div className="ldo-tabs">{([['month', 'חודש'], ['week', 'שבוע'], ['agenda', 'רשימה']] as const).map(([v, l]) => <button key={v} className={view === v ? 'on' : ''} onClick={() => go(a, v)}>{l}</button>)}</div>
    </div>

    {view !== 'agenda' ? <div className={`cal-grid ${view}`}>
      {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
      {days.map((d) => { const k = key(d); const list = (byDay.get(k) ?? []).sort((x, y) => (x.type === 'holiday' ? -1 : y.type === 'holiday' ? 1 : x.all_day === y.all_day ? x.start.localeCompare(y.start) : x.all_day ? -1 : 1)); const hol = list.find((x) => x.type === 'holiday'); const out = view === 'month' && d.getUTCMonth() !== a.getUTCMonth();
        const max = view === 'month' ? 4 : 40;
        return <div key={k} className={`cal-day${k === today ? ' today' : ''}${out ? ' out' : ''}${d.getUTCDay() === 6 ? ' sat' : ''}${hol ? (hol.no_marketing ? ' memorial' : ' hol') : ''}`} onDoubleClick={() => newItem(k)} onClick={() => setSel(k)} data-sel={(sel ?? today) === k ? '1' : undefined}>
          <header><span>{f(d, { day: 'numeric' })}</span><button className="cal-plus" onClick={() => newItem(k)} aria-label="הוספה">＋</button></header>
          {list.slice(0, max).map((x) => <button key={x.type + x.id} className={`cal-ev t-${x.type}${x.overdue ? ' late' : ''}${x.status === 'done' ? ' done' : ''}`} onClick={() => setPeek(x)} title={x.title}>
            <i>{TYPE[x.type]?.[1]}</i>{!x.all_day && <em>{time(x.start)}</em>}<span>{x.title}</span>{x.type === 'meeting' && !x.client_id && !x.lead_id && x.source === 'google' ? <b className="unl" title="לא משויך">•</b> : null}</button>)}
          {list.length > max && <button className="cal-more" onClick={() => go(d, 'week')}>+{list.length - max} נוספים</button>}
        </div>; })}
    </div> : null}
    {view === 'month' && (() => { const k = sel ?? today; const list = (byDay.get(k) ?? []).slice().sort((x, y) => (x.all_day === y.all_day ? x.start.localeCompare(y.start) : x.all_day ? -1 : 1));
      return <section className="cal-daylist">
        <header><b>{f(`${k}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })}</b><button className="btn sm y" onClick={() => newItem(k)}>＋ הוספה</button></header>
        {list.length ? list.map((x) => <button key={x.type + x.id} className={`cal-row t-${x.type}${x.overdue ? ' late' : ''}`} onClick={() => setPeek(x)}><i>{TYPE[x.type]?.[1]}</i><em>{x.all_day ? 'כל היום' : time(x.start)}</em><b>{x.title}</b><span>{x.client ?? ''}</span></button>)
          : <div className="empty">יום פנוי — אין אירועים.</div>}
      </section>; })()}
    {view === 'agenda' && <div className="cal-agenda">{[...byDay.entries()].filter(([k]) => k >= key(new Date(a.getTime() - 864e5 * 0))).sort().slice(0, 40).map(([k, list]) => <section key={k} className={k === today ? 'today' : ''}>
        <h3>{f(`${k}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
        {list.map((x) => <button key={x.type + x.id} className={`cal-row t-${x.type}${x.overdue ? ' late' : ''}`} onClick={() => setPeek(x)}><i>{TYPE[x.type]?.[1]}</i><em>{x.all_day ? 'כל היום' : time(x.start)}</em><b>{x.title}</b><span>{x.client ?? ''}</span></button>)}
      </section>)}{!byDay.size && <div className="empty">אין אירועים בטווח הזה.</div>}</div>}

    {peek && <Sheet onClose={() => setPeek(null)} title={TYPE[peek.type]?.[0]}>
      <h2 style={{ marginTop: 0 }}>{peek.title}</h2>
      <p className="muted">{peek.all_day ? f(peek.start, { weekday: 'long', day: 'numeric', month: 'long' }) : `${f(peek.start, { weekday: 'long', day: 'numeric', month: 'long' })} · ${time(peek.start)}${peek.end ? `–${time(peek.end)}` : ''}`}</p>
      {peek.client && <p>👤 {peek.client_id ? <Link href={`/clients/${peek.client_id}`}>{peek.client}</Link> : peek.client}</p>}
      {peek.lead && <p>↗ ליד: <Link href={`/leads/${peek.lead_id}`}>{peek.lead}</Link></p>}
      {(peek.type === 'meeting') && <LinkBox m={peek} clients={clients} leads={leads} onDone={() => setPeek(null)} />}
      {peek.location && <p>📍 {peek.location}</p>}{peek.service && <p>שירות: {peek.service}</p>}
      {(peek.description || peek.notes) && <p style={{ whiteSpace: 'pre-wrap' }}>{peek.description || peek.notes}</p>}
      {peek.type === 'holiday' && <>{peek.hebrew && <p>{peek.hebrew}</p>}{peek.no_marketing ? <p className="ldo-flash bad">יום זיכרון / יום ללא שיווק — לא מתזמנים פוסטים שיווקיים</p> : <p className="small muted">{peek.kind === 'marketing' ? 'יום שיווקי — הזדמנות לתוכן' : 'חג / מועד'}</p>}{peek.memo && <p>{peek.memo}</p>}</>}
      {peek.source === 'google' && <p className="small muted">מגיע מ-Google Calendar</p>}
      {peek.sync === 'error' && <p className="small" style={{ color: 'var(--bad)' }}>הסנכרון ל-Google נכשל — ננסה שוב</p>}
      <div className="row" style={{ marginTop: 12 }}>
        {peek.type === 'meeting' && <><button className="btn y" onClick={() => { setEdit({ type: 'meeting', id: peek.id, title: peek.title, date: key(peek.start), time: time(peek.start), end: peek.end ? time(peek.end) : '', client_id: peek.client_id ?? '', location: peek.location ?? '', description: peek.description ?? '', all_day: peek.all_day }); setPeek(null); }}>עריכה</button>
          <Act a="meeting_cancel" p={{ id: peek.id }} l="ביטול פגישה" cls="btn danger" confirm="לבטל את הפגישה? היא תימחק גם מ-Google." done={() => setPeek(null)} /></>}
        {peek.type === 'todo' && <><Act a="todo_set" p={{ id: peek.id, status: peek.status === 'done' ? 'open' : 'done' }} l={peek.status === 'done' ? 'החזר לפתוחה' : '✓ בוצע'} cls="btn y" done={() => setPeek(null)} />
          <button className="btn" onClick={() => { setEdit({ type: 'todo', id: peek.id, title: peek.title, date: key(peek.start), time: time(peek.start), client_id: peek.client_id ?? '', description: peek.notes ?? '', all_day: peek.all_day }); setPeek(null); }}>עריכה</button>
          <Act a="todo_set" p={{ id: peek.id, status: 'cancelled' }} l="מחיקה" cls="btn ghost" done={() => setPeek(null)} /></>}
        {peek.type === 'milestone' && <Act a="milestone_update" p={{ id: peek.id, status: peek.status === 'done' ? 'todo' : 'done' }} l={peek.status === 'done' ? 'החזר לביצוע' : '✓ בוצע'} cls="btn y" done={() => setPeek(null)} />}
        {peek.href && <Link className="btn ghost" href={peek.href}>לעמוד המלא ←</Link>}
      </div>
    </Sheet>}

    {edit && <Sheet onClose={() => setEdit(null)} title={edit.id ? 'עריכה' : edit.type === 'meeting' ? 'פגישה חדשה' : 'משימה חדשה'}>
      <EditForm e={edit} clients={clients} onDone={() => { setEdit(null); r.refresh(); }} />
    </Sheet>}

    {gPanel && <Sheet onClose={() => { setGPanel(false); if (gFlash) r.replace('/calendar'); }} title="Google Calendar">
      {gFlash && <div className={`ldo-flash ${gFlash === 'connected' ? 'ok' : 'bad'}`}>{({ connected: 'החיבור הצליח ✓ הסנכרון פעיל', denied: 'הגישה לא אושרה בגוגל', bad_state: 'פג תוקף הבקשה — נסה שוב', failed: 'החיבור נכשל — נסה שוב', not_configured: 'חסרים GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ב-Vercel', forbidden: 'רק Owner/Admin יכול לחבר' } as any)[gFlash] ?? gFlash}</div>}
      <h3>סנכרון דו-כיווני</h3>
      {gAccounts.length ? <><div className="g-accs">{gAccounts.map((a: any) => <div key={a.account} className="g-acc"><b dir="ltr">{a.account}</b>{a.primary && <span className="badge cyan">ראשי · מקבל פגישות מהמערכת</span>}
          <small>{a.events} אירועים · סנכרון אחרון {a.last_sync_at ? f(a.last_sync_at, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}{a.last_error ? ` · שגיאה: ${a.last_error}` : ''}</small></div>)}</div>
        <p className="small muted">אירועים מכל היומנים נכנסים לכאן. פגישה שמופיעה ביותר מיומן אחד (הזמנה משותפת, או אותה כותרת ואותה שעה) מוצגת פעם אחת. פגישות שנוצרות כאן נכנסות ליומן הראשי.</p>
        <div className="row"><button className="btn" disabled={syncing} onClick={async () => { setSyncing(true); await fetch('/api/google/sync', { method: 'POST' }).catch(() => null); setSyncing(false); r.refresh(); }}>{syncing ? 'מסנכרן…' : 'סנכרן עכשיו'}</button>
          {canConnect && <a className="btn y" href="/api/google/connect">＋ חבר יומן נוסף</a>}</div></>
        : gConfigured ? (canConnect ? <><p>לחיצה אחת, אישור בגוגל, וזה מחובר.</p><a className="btn y" href="/api/google/connect">חבר את Google Calendar ←</a></> : <p className="muted">רק Owner/Admin יכול לחבר.</p>)
        : <><p>כדי להפעיל צריך להגדיר ב-Vercel את <code>GOOGLE_CLIENT_ID</code> ו-<code>GOOGLE_CLIENT_SECRET</code> (OAuth client מסוג Web, עם redirect <code dir="ltr">{typeof window !== 'undefined' ? window.location.origin : ''}/api/google/callback</code>).</p></>}
      {feed && <><h3 style={{ marginTop: 18 }}>מנוי לקריאה בלבד (ICS)</h3><p className="small muted">עובד מיד ובלי חיבור: ב-Google Calendar ← ״יומנים אחרים״ ← ״+״ ← ״מכתובת URL״ ← להדביק. גוגל מתעדכן כל כמה שעות. מי שמחזיק בקישור רואה את כותרות היומן — לא לשתף.</p>
        <div className="row"><input readOnly value={feed} dir="ltr" onFocus={(e) => e.currentTarget.select()} /><button className="btn sm" onClick={() => { navigator.clipboard?.writeText(feed); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'הועתק ✓' : 'העתק'}</button></div></>}
    </Sheet>}
  </div>;
}

function Act({ a, p, l, cls, confirm, done }: { a: string; p: any; l: string; cls: string; confirm?: string; done?: () => void }) {
  const r = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  return <><button className={cls} disabled={busy} onClick={async () => { if (confirm && !window.confirm(confirm)) return; setBusy(true); try { await callAction(a, p); done?.(); r.refresh(); } catch (e) { setErr(heError(e)); } finally { setBusy(false); } }}>{busy ? '…' : l}</button>{err && <span className="small" style={{ color: 'var(--bad)' }}>{err}</span>}</>;
}

function EditForm({ e, clients, onDone }: { e: any; clients: { id: string; name: string }[]; onDone: () => void }) {
  const [v, setV] = useState(e); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k: string) => (x: any) => setV({ ...v, [k]: x.target.type === 'checkbox' ? x.target.checked : x.target.value });
  async function save() {
    setBusy(true); setErr('');
    try {
      if (v.type === 'meeting') await callAction('meeting_save', { id: v.id, title: v.title, starts_at: v.all_day ? iso(v.date, '00:00') : iso(v.date, v.time), ends_at: v.all_day ? iso(v.date, '23:59') : v.end ? iso(v.date, v.end) : null, client_id: v.client_id || null, location: v.location, description: v.description, all_day: v.all_day });
      else await callAction('todo_save', { id: v.id, title: v.title, due_at: v.date ? (v.all_day ? iso(v.date, '12:00') : iso(v.date, v.time)) : null, all_day: v.all_day, client_id: v.client_id || null, notes: v.description, priority: v.priority });
      onDone();
    } catch (x) { setErr(heError(x)); } finally { setBusy(false); }
  }
  return <form className="f" onSubmit={(x) => { x.preventDefault(); save(); }}>
    {!e.id && <div className="ldo-tabs">{(['meeting', 'todo'] as const).map((t) => <button type="button" key={t} className={v.type === t ? 'on' : ''} onClick={() => setV({ ...v, type: t, all_day: t === 'todo' })}>{t === 'meeting' ? 'פגישה' : 'משימה'}</button>)}</div>}
    <label>כותרת<input value={v.title} onChange={set('title')} required autoFocus placeholder={v.type === 'meeting' ? 'למשל: פגישת התנעה עם…' : 'מה צריך לעשות?'} /></label>
    <div className="cal-f2"><label>תאריך<input type="date" value={v.date} onChange={set('date')} required /></label>
      {!v.all_day && <label>{v.type === 'meeting' ? 'משעה' : 'שעה'}<input type="time" value={v.time} onChange={set('time')} /></label>}
      {!v.all_day && v.type === 'meeting' && <label>עד<input type="time" value={v.end} onChange={set('end')} /></label>}</div>
    <label className="cal-check"><input type="checkbox" checked={!!v.all_day} onChange={set('all_day')} /> כל היום</label>
    <label>לקוח<select value={v.client_id} onChange={set('client_id')}><option value="">— ללא —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {v.type === 'meeting' && <label>מיקום / קישור<input value={v.location} onChange={set('location')} placeholder="כתובת או קישור Zoom/Meet" /></label>}
    {v.type === 'todo' && <label>עדיפות<select value={v.priority ?? 'normal'} onChange={set('priority')}><option value="low">נמוכה</option><option value="normal">רגילה</option><option value="high">גבוהה</option></select></label>}
    <label>{v.type === 'meeting' ? 'תיאור / סדר יום' : 'הערות'}<textarea value={v.description} onChange={set('description')} rows={3} /></label>
    {err && <div className="ldo-flash bad">{err}</div>}
    <div className="row"><button className="btn y" disabled={busy || !v.title.trim()}>{busy ? '…' : 'שמירה'}</button></div>
  </form>;
}


function LinkBox({ m, clients, leads, onDone }: { m: any; clients: { id: string; name: string }[]; leads: { id: string; name: string }[]; onDone: () => void }) {
  const r = useRouter(); const [v, setV] = useState(m.client_id ? `c:${m.client_id}` : m.lead_id ? `l:${m.lead_id}` : ''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const linked = !!(m.client_id || m.lead_id);
  async function save(val: string) { setBusy(true); setErr(''); try { await callAction('meeting_link', { id: m.id, client_id: val.startsWith('c:') ? val.slice(2) : null, lead_id: val.startsWith('l:') ? val.slice(2) : null }); r.refresh(); onDone(); } catch (e) { setErr(heError(e)); } finally { setBusy(false); } }
  return <div className={`linkbox${linked ? '' : ' warn'}`}>
    <b>{linked ? 'משויך' : 'הפגישה לא משויכת ללקוח או לליד'}</b>
    <div className="row"><select value={v} onChange={(e) => setV(e.target.value)} disabled={busy}><option value="">— בחר לקוח או ליד —</option>
      <optgroup label="לקוחות">{clients.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>
      <optgroup label="לידים">{leads.map((l) => <option key={l.id} value={`l:${l.id}`}>{l.name}</option>)}</optgroup></select>
      <button className="btn sm y" disabled={busy || v === (m.client_id ? `c:${m.client_id}` : m.lead_id ? `l:${m.lead_id}` : '')} onClick={() => save(v)}>{busy ? '…' : 'שייך'}</button></div>
    <small className="muted">{m.reminder_sent_at ? `✓ נשלחה תזכורת במייל ל-${(m.reminder_to ?? []).join(', ')}` : linked || m.source === 'office' ? (m.remind ? '✉ תזכורת תישלח אוטומטית במייל יום לפני, למשתתפים / לאיש הקשר' : 'תזכורת במייל כבויה לפגישה הזו') : 'אחרי שיוך — תישלח תזכורת אוטומטית במייל יום לפני'}</small>
    {(linked || m.source === 'office') && !m.reminder_sent_at && <button className="btn sm ghost" onClick={async () => { await callAction('meeting_remind', { id: m.id, remind: !m.remind }); r.refresh(); onDone(); }}>{m.remind ? 'כבה תזכורת לפגישה הזו' : 'הפעל תזכורת'}</button>}
    {err && <span className="small" style={{ color: 'var(--bad)' }}>{err}</span>}</div>;
}
