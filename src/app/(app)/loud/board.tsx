'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';

const COLS: [string, string, string[]][] = [
  ['הכנה', 'הסוכנים חוקרים', ['intake']], ['לאישורך', 'קובץ שאלות מוכן', ['questions_review', 'changes_requested']], ['אצל האורח', 'עיון ואישור', ['client_review']],
  ['תשלום', 'ממתין לתשלום', ['awaiting_payment']], ['מועד', 'שולם / נקבע', ['paid', 'scheduled']], ['אחרי הקלטה', 'עריכה ומסירה', ['recorded', 'delivered']],
];
const ST: Record<string, string> = { intake: 'בהכנה', questions_review: 'לאישורך', changes_requested: 'ביקש שינויים', client_review: 'אצל האורח', awaiting_payment: 'ממתין לתשלום', paid: 'שולם · בחירת מועד', scheduled: 'נקבע', recorded: 'הוקלט', delivered: 'נמסר' };
const TZ = 'Asia/Jerusalem';
const fd = (s: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, ...o }).format(new Date(s));
const money = (n: number) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);

export function LoudBoard({ d, intake }: { d: any; intake: string }) {
  const r = useRouter(); const [copied, setCopied] = useState(false); const [tab, setTab] = useState<'pipe' | 'cal' | 'set'>('pipe');
  const bookings: any[] = d.bookings ?? []; const slots: any[] = d.slots ?? [];
  const now = Date.now(); const week = now + 7 * 864e5;
  const live = bookings.filter((b) => !['cancelled', 'no_show'].includes(b.status));
  const k = {
    waiting: bookings.filter((b) => ['questions_review', 'changes_requested'].includes(b.status)).length,
    week: live.filter((b) => b.starts_at && +new Date(b.starts_at) > now && +new Date(b.starts_at) < week).length,
    open: slots.filter((s) => s.status === 'open' && +new Date(s.starts_at) > now).length,
    pay: bookings.filter((b) => b.status === 'awaiting_payment').reduce((a, b) => a + Number(b.price ?? 0), 0),
    msgs: bookings.reduce((a, b) => a + Number(b.msgs_waiting ?? 0), 0),
  };
  const next = live.filter((b) => b.starts_at && +new Date(b.starts_at) > now - 36e5).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];
  return <div className="ldo">
    <section className="ldo-hero">
      <div className="ldo-hero-bg" style={{ backgroundImage: 'url(/brand/loud-studio-mic.webp)' }} />
      <div className="ldo-hero-in">
        <img src="/brand/loud-on-dark.svg" alt="LOUD Podcast Studio" className="ldo-logo" />
        <div className="ldo-hero-txt"><h1>אולפן הפודקאסטים</h1><p>מטופס היכרות ועד חומרים ערוכים: הסוכנים חוקרים ומכינים שאלות, ואתה מאשר כל שלב.</p></div>
        <div className="ldo-hero-act">
          <button className="ldo-btn" onClick={() => { navigator.clipboard?.writeText(intake); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? 'הקישור הועתק ✓' : '🔗 העתק קישור לטופס היכרות'}</button>
          <a className="ldo-btn ghost" href={intake} target="_blank" rel="noreferrer">צפייה בטופס ↗</a>
        </div>
      </div>
      {next && <Link href={`/loud/${next.id}`} className="ldo-next"><small>ההקלטה הבאה</small><b>{next.guest}</b><span>{fd(next.starts_at, { weekday: 'long', day: 'numeric', month: 'numeric' })} · {fd(next.starts_at, { hour: '2-digit', minute: '2-digit' })}</span></Link>}
    </section>

    <div className="ldo-kpis">
      <Kpi n={k.waiting} l="קבצי שאלות לאישורך" hot={k.waiting > 0} />
      <Kpi n={k.week} l="הקלטות השבוע" />
      <Kpi n={k.open} l="משבצות פנויות" warn={k.open < 3} />
      <Kpi n={k.pay ? money(k.pay) : '—'} l="ממתין לתשלום" />
      <Kpi n={k.msgs} l="הודעות לאישורך" hot={k.msgs > 0} href="/approvals" />
    </div>

    <div className="ldo-tabs" role="tablist">{([['pipe', 'מסלול האורחים'], ['cal', 'יומן אולפן וזמינות'], ['set', 'חבילות והגדרות']] as const).map(([v, l]) =>
      <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}</button>)}</div>

    {tab === 'pipe' && (bookings.length ? <div className="ldo-pipe">{COLS.map(([t, sub, sts]) => { const items = bookings.filter((b) => sts.includes(b.status));
      return <section key={t} className="ldo-col"><header><b>{t}</b><span>{sub}</span><i>{items.length}</i></header>
        {items.map((b) => <Link key={b.id} href={`/loud/${b.id}`} className={`ldo-bk s-${b.status}`}>
          <div className="ldo-bk-h"><span className="ldo-av">{(b.guest ?? '?').slice(0, 1)}</span><div><b>{b.guest}</b><small>{b.business}</small></div></div>
          <div className="ldo-bk-m"><span className="ldo-chip">{ST[b.status] ?? b.status}</span>{b.starts_at && <span className="ldo-chip k">🎙 {fd(b.starts_at, { day: 'numeric', month: 'numeric' })} {fd(b.starts_at, { hour: '2-digit', minute: '2-digit' })}</span>}
            {b.msgs_waiting > 0 && <span className="ldo-chip y">✉ {b.msgs_waiting}</span>}{b.is_test && <span className="ldo-chip">בדיקה</span>}</div>
          {b.working && <div className="ldo-working"><i />{b.working}</div>}
        </Link>)}
        {!items.length && <div className="ldo-empty">—</div>}</section>; })}</div>
      : <div className="ldo-onb"><img src="/brand/loud-icon.svg" alt="" /><h2>עוד אין אורחים</h2><p>שלחו את הקישור לטופס ההיכרות ללקוח, ואחרי שהוא ממלא, הכרטיס שלו יופיע כאן והסוכנים יתחילו לחקור.</p>
        <ol><li>שלחו את הקישור לטופס</li><li>הסוכנים חוקרים ובונים קובץ שאלות לשעת ראיון</li><li>אתה מאשר, והאורח מקבל את הקובץ לעיון</li><li>האורח מאשר, משלם ובוחר מועד מתוך הזמינות שלך</li><li>תזכורת יום לפני, תודה יום אחרי, ושליחת החומרים, כל הודעה באישורך</li></ol></div>)}

    {tab === 'cal' && <StudioCalendar slots={slots} onChange={() => r.refresh()} />}
    {tab === 'set' && <Settings s={d.settings} onChange={() => r.refresh()} />}
  </div>;
}
function Kpi({ n, l, hot, warn, href }: { n: any; l: string; hot?: boolean; warn?: boolean; href?: string }) {
  const c = <><b>{n}</b><span>{l}</span></>; const cls = `ldo-kpi${hot ? ' hot' : ''}${warn ? ' warn' : ''}`;
  return href ? <Link href={href} className={cls}>{c}</Link> : <div className={cls}>{c}</div>;
}

function StudioCalendar({ slots, onChange }: { slots: any[]; onChange: () => void }) {
  const [start, setStart] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d; });
  const [form, setForm] = useState({ date: dayKey(new Date(Date.now() + 864e5)), time: '10:00', minutes: 60, count: 3, gap: 15, weeks: 1 });
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; }), [start]);
  async function add() {
    setBusy(true); setMsg('');
    try { const iso = new Date(`${form.date}T${form.time}:00${tzOffset(form.date)}`).toISOString();
      const res = await callAction('studio_add_slots', { starts_at: iso, minutes: form.minutes, count: form.count, gap_minutes: form.gap, weeks: form.weeks });
      setMsg(res.added ? `נוספו ${res.added} משבצות ✓` : 'לא נוספו משבצות (חופפות לקיימות)'); onChange();
    } catch (e) { setMsg(heError(e)); } finally { setBusy(false); }
  }
  async function slot(id: string, op: string) { try { await callAction('studio_slot_update', { slot_id: id, op }); onChange(); } catch (e) { setMsg(heError(e)); } }
  return <div className="ldo-cal-wrap">
    <section className="card ldo-add"><h3>הוספת זמינות לאולפן</h3>
      <div className="ldo-add-f">
        <label>תאריך<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
        <label>משעה<input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
        <label>אורך (דק׳)<input type="number" min={15} step={15} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: +e.target.value })} /></label>
        <label>מספר הקלטות ברצף<input type="number" min={1} max={10} value={form.count} onChange={(e) => setForm({ ...form, count: +e.target.value })} /></label>
        <label>הפסקה בין הקלטות<input type="number" min={0} step={5} value={form.gap} onChange={(e) => setForm({ ...form, gap: +e.target.value })} /></label>
        <label>חזרה שבועית<select value={form.weeks} onChange={(e) => setForm({ ...form, weeks: +e.target.value })}>{[1, 2, 4, 8, 12].map((w) => <option key={w} value={w}>{w === 1 ? 'פעם אחת' : `${w} שבועות`}</option>)}</select></label>
      </div>
      <div className="row"><button className="btn y" onClick={add} disabled={busy}>{busy ? '…' : '＋ פתח משבצות'}</button>{msg && <span className="small muted" role="status">{msg}</span>}</div></section>
    <div className="row ldo-cal-nav"><button className="btn sm ghost" onClick={() => { const d = new Date(start); d.setDate(d.getDate() - 7); setStart(d); }}>→ שבוע קודם</button>
      <b>{fd(days[0].toISOString(), { day: 'numeric', month: 'long' })} – {fd(days[13].toISOString(), { day: 'numeric', month: 'long' })}</b>
      <button className="btn sm ghost" onClick={() => { const d = new Date(start); d.setDate(d.getDate() + 7); setStart(d); }}>שבוע הבא ←</button>
      <span className="sp" /><span className="ldo-leg"><i className="open" />פנוי <i className="booked" />תפוס <i className="blocked" />חסום</span></div>
    <div className="ldo-cal">{days.map((d) => { const key = dayKey(d); const ss = slots.filter((s) => dayKey(new Date(s.starts_at)) === key); const today = key === dayKey(new Date());
      return <div key={key} className={`ldo-day${today ? ' today' : ''}${d.getDay() === 6 ? ' sat' : ''}`}><header><b>{fd(d.toISOString(), { weekday: 'short' })}</b><span>{fd(d.toISOString(), { day: 'numeric', month: 'numeric' })}</span></header>
        {ss.map((s) => <div key={s.id} className={`ldo-slot ${s.status}`}>
          <b>{fd(s.starts_at, { hour: '2-digit', minute: '2-digit' })}</b>
          {s.status === 'booked' ? <Link href={`/loud/${s.booking_id}`}>{s.guest ?? 'תפוס'}</Link> : <span>{s.status === 'open' ? 'פנוי' : 'חסום'}</span>}
          {s.status !== 'booked' && <span className="ldo-slot-a">{s.status === 'open' ? <button title="חסום" onClick={() => slot(s.id, 'block')}>⦸</button> : <button title="פתח" onClick={() => slot(s.id, 'open')}>↺</button>}<button title="מחק" onClick={() => slot(s.id, 'delete')}>✕</button></span>}
        </div>)}
      </div>; })}</div>
  </div>;
}
// Jerusalem offset for a given local date (handles DST): "+02:00" / "+03:00"
function tzOffset(date: string) {
  const d = new Date(`${date}T12:00:00Z`); const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' }).formatToParts(d).find((x) => x.type === 'timeZoneName')?.value ?? 'GMT+2';
  const m = p.match(/GMT([+-]\d+)/); const h = m ? Number(m[1]) : 2; return `${h >= 0 ? '+' : '-'}${String(Math.abs(h)).padStart(2, '0')}:00`;
}

function Settings({ s, onChange }: { s: any; onChange: () => void }) {
  const [f, setF] = useState({ address: s?.address ?? '', parking: s?.parking ?? '', prep_guide: s?.prep_guide ?? '', packages: (s?.packages ?? []) as any[] });
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const pk = (i: number, k: string, v: any) => { const a = [...f.packages]; a[i] = { ...a[i], [k]: v }; setF({ ...f, packages: a }); };
  async function save() { setBusy(true); try { await callAction('studio_save_settings', f); setMsg('נשמר ✓'); onChange(); } catch (e) { setMsg(heError(e)); } finally { setBusy(false); } }
  return <div className="ldo-set">
    <section className="card"><h3>חבילות</h3><p className="muted small">החבילה הראשונה היא ברירת המחדל לכל אורח חדש. אפשר לשנות לכל אורח בנפרד, כולל דיל מותאם.</p>
      {f.packages.map((p, i) => <div key={i} className="ldo-pk"><input value={p.title} onChange={(e) => pk(i, 'title', e.target.value)} placeholder="שם החבילה" />
        <input type="number" value={p.price} onChange={(e) => pk(i, 'price', +e.target.value)} placeholder="מחיר" />
        <select value={p.vat_mode ?? 'included'} onChange={(e) => pk(i, 'vat_mode', e.target.value)}><option value="included">כולל מע״מ</option><option value="plus_vat">+ מע״מ</option><option value="exempt">פטור</option></select>
        <input value={p.description} onChange={(e) => pk(i, 'description', e.target.value)} placeholder="מה כלול" className="w" />
        <button className="btn sm ghost" onClick={() => setF({ ...f, packages: f.packages.filter((_, j) => j !== i) })}>הסר</button></div>)}
      <button className="btn sm" onClick={() => setF({ ...f, packages: [...f.packages, { key: `p${Date.now()}`, title: '', price: 0, vat_mode: 'included', description: '' }] })}>＋ חבילה</button></section>
    <section className="card"><h3>פרטי האולפן להודעות לאורחים</h3>
      <form className="f" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label>כתובת האולפן<input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
        <label>חניה והגעה<input value={f.parking} onChange={(e) => setF({ ...f, parking: e.target.value })} /></label>
        <label>מדריך הכנה לאורח <span className="hint">שורה לכל טיפ. ריק = טיפים ברירת מחדל</span><textarea value={f.prep_guide} onChange={(e) => setF({ ...f, prep_guide: e.target.value })} rows={4} /></label>
      </form></section>
    <div className="row"><button className="btn y" onClick={save} disabled={busy}>{busy ? '…' : 'שמירת הגדרות'}</button>{msg && <span className="small muted">{msg}</span>}</div>
  </div>;
}
