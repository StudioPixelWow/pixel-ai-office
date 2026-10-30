'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
const STEPS = [['הכנה', ['intake', 'questions_review']], ['קובץ שאלות', ['client_review', 'changes_requested']], ['תשלום', ['awaiting_payment']], ['מועד', ['paid']], ['הקלטה', ['scheduled']], ['חומרים', ['recorded', 'delivered']]] as const;
const dt = (s: string) => new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(s));
const tm = (s: string) => new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }).format(new Date(s));
const money = (n: number) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
export function GuestJourney({ t, d }: { t: string; d: any }) {
  const r = useRouter(); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [fb, setFb] = useState(''); const [ask, setAsk] = useState(false); const [pick, setPick] = useState<string | null>(null);
  const cur = Math.max(0, STEPS.findIndex(([, s]) => (s as readonly string[]).includes(d.status)));
  async function go(op: string, extra: any = {}) {
    setBusy(op); setErr('');
    const res = await fetch(`/api/public/podcast/${t}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, ...extra }) });
    const j = await res.json().catch(() => ({})); setBusy('');
    if (!res.ok) return setErr(j.error ?? 'משהו השתבש');
    if (op === 'payment' && j.url) { window.location.href = j.url; return; }
    setPick(null); setAsk(false); r.refresh();
  }
  const kit = d.kit; const nQ = kit ? kit.segments.reduce((a: number, s: any) => a + (s.questions?.length ?? 0), 0) : 0;
  const days = groupDays(d.open_slots ?? []);
  return <>
    <section className="ld-card ld-hello">
      <small>הפרק של</small><h1>{d.name}{d.business && d.business !== d.name ? <span> · {d.business}</span> : null}</h1>
      <ol className="ld-track">{STEPS.map(([l], i) => <li key={l} className={i < cur ? 'ok' : i === cur ? 'on' : ''}><b>{i < cur ? '✓' : i + 1}</b><span>{l}</span></li>)}</ol>
    </section>
    {err && <div className="ld-err" role="alert">{err}</div>}

    {(d.status === 'intake' || d.status === 'questions_review') && <section className="ld-card ld-center"><div className="ld-pulse">🎙️</div><h2>אנחנו מכינים לך קובץ שאלות</h2><p className="ld-muted">חוקרים את העסק, הרשתות והסיפור שלך — ונשלח הודעה ברגע שהקובץ מוכן לעיון.</p></section>}

    {d.starts_at && ['scheduled', 'paid'].includes(d.status) && <section className="ld-card ld-when"><small>נתראה באולפן</small><h2>{dt(d.starts_at)} · {tm(d.starts_at)}</h2>
      {d.address && <p>📍 {d.address}</p>}{d.parking && <p>🚗 {d.parking}</p>}
      <a className="ld-btn ghost" href={ics(d)} download="loud-recording.ics">הוספה ליומן</a></section>}

    {d.status === 'awaiting_payment' && <section className="ld-card ld-pay"><div><small>הקובץ אושר ✓ · השלב הבא</small><h2>{d.package_title || 'הקלטה באולפן'}</h2><p>{d.package_desc}</p></div>
      <div className="ld-price"><b>{money(Number(d.price))}</b><span>{d.vat_mode === 'plus_vat' ? '+ מע״מ' : 'כולל מע״מ'}</span></div>
      <button className="ld-btn" onClick={() => go('payment')} disabled={!!busy}>{busy === 'payment' ? 'פותח תשלום…' : 'לתשלום מאובטח ←'}</button></section>}

    {['paid', 'scheduled'].includes(d.status) && <section className="ld-card"><h2>{d.status === 'scheduled' ? 'רוצה להחליף מועד?' : 'בחרו מועד להקלטה'}</h2>
      {!days.length ? <p className="ld-muted">כרגע אין מועדים פנויים בלוח — נחזור אליך עם הצעה בהקדם.</p> :
        <div className="ld-days">{days.map(([day, slots]) => <div key={day} className="ld-day"><b>{day}</b><div>{slots.map((s: any) => <button key={s.id} className={pick === s.id ? 'on' : ''} onClick={() => setPick(s.id)}>{tm(s.starts_at)}</button>)}</div></div>)}</div>}
      {pick && <button className="ld-btn" onClick={() => go('slot', { slot_id: pick })} disabled={!!busy}>{busy === 'slot' ? 'שומר…' : 'קובעים ←'}</button>}</section>}

    {kit && <section className="ld-card ld-kit">
      <div className="ld-kit-h"><div><small>קובץ השאלות · כ-{kit.segments.reduce((a: number, s: any) => a + Number(s.minutes || 0), 0)} דק׳ · {nQ} שאלות</small><h2>{kit.angle || 'הראיון שלך'}</h2><p>{kit.summary}</p></div></div>
      {kit.opener && <div className="ld-open"><b>פתיח</b><p>{kit.opener}</p></div>}
      {kit.segments.map((s: any, i: number) => <details key={i} className="ld-seg" open={i < 2}><summary><b>{i + 1}</b><span>{s.title}</span><em>{s.minutes} דק׳</em></summary>
        {s.goal && <p className="ld-muted">{s.goal}</p>}<ol>{s.questions.map((q: any, j: number) => <li key={j}>{q.q}{q.followups?.length ? <ul>{q.followups.map((x: string, k: number) => <li key={k}>{x}</li>)}</ul> : null}</li>)}</ol></details>)}
      {kit.closer && <div className="ld-open"><b>סגירה</b><p>{kit.closer}</p></div>}
      {['client_review', 'changes_requested'].includes(d.status) && <div className="ld-approve">
        {d.status === 'changes_requested' && <p className="ld-note">קיבלנו את ההערות שלך ואנחנו מעדכנים. אפשר גם לאשר כמו שזה.</p>}
        {ask ? <><textarea value={fb} onChange={(e) => setFb(e.target.value)} rows={4} placeholder="מה להוסיף, להוריד או לשנות?" />
          <div className="ld-nav"><button className="ld-btn ghost" onClick={() => setAsk(false)}>ביטול</button><button className="ld-btn" disabled={!fb.trim() || !!busy} onClick={() => go('changes', { feedback: fb })}>שליחת ההערות</button></div></>
          : <div className="ld-nav"><button className="ld-btn ghost" onClick={() => setAsk(true)}>יש לי הערות</button><button className="ld-btn" disabled={!!busy} onClick={() => go('approve')}>{busy === 'approve' ? 'מאשר…' : 'מאשר/ת את השאלות ✓'}</button></div>}
      </div>}
    </section>}

    {['scheduled', 'paid'].includes(d.status) && <section className="ld-card"><h2>איך מתכוננים?</h2>
      <ul className="ld-tips">{(d.prep_guide ? String(d.prep_guide).split('\n').filter(Boolean) : ['בגדים בצבע אחיד — בלי פסים דקים ובלי לוגו גדול', 'להגיע 10 דקות לפני, לשתות מים ולהתחמם', 'לעבור על קובץ השאלות — לא לשנן, רק להיזכר בסיפורים', 'להביא מוצר / אביזר שקשור לעסק — מעולה לצילום']).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></section>}

    {['recorded', 'delivered'].includes(d.status) && <section className="ld-card"><h2>{d.deliverables?.length ? 'החומרים שלך מוכנים 🎧' : 'איזה כיף היה! אנחנו בעריכה'}</h2>
      {d.deliverables?.length ? <div className="ld-files">{d.deliverables.map((x: any) => <a key={x.id} href={x.url} target="_blank" rel="noreferrer"><b>▶</b><span>{x.title}</span></a>)}</div>
        : <p className="ld-muted">נשלח הודעה ברגע שהחומרים הערוכים מוכנים.</p>}</section>}
  </>;
}
function groupDays(slots: any[]) {
  const m = new Map<string, any[]>(); for (const s of slots) { const k = dt(s.starts_at); m.set(k, [...(m.get(k) ?? []), s]); } return [...m.entries()].slice(0, 14);
}
function ics(d: any) {
  const f = (s: string) => new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LOUD//Podcast//HE', 'BEGIN:VEVENT', `UID:${d.id}@loud`, `DTSTART:${f(d.starts_at)}`, `DTEND:${f(d.ends_at ?? d.starts_at)}`, 'SUMMARY:הקלטת פודקאסט · LOUD', `LOCATION:${d.address ?? 'אולפן LOUD'}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
}
