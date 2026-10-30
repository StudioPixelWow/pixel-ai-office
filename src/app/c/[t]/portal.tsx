'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TZ = 'Asia/Jerusalem';
const fd = (d: string | null | undefined, o: Intl.DateTimeFormatOptions) => d ? new Intl.DateTimeFormat('he-IL', { timeZone: TZ, ...o }).format(new Date(d.length === 10 ? `${d}T12:00:00Z` : d)) : '';
const money = (n: any) => `${Number(n ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })} ₪`;
const MS: Record<string, [string, string]> = { todo: ['מתוכנן', 'todo'], in_progress: ['בעבודה', 'prog'], waiting_client: ['מחכה לכם', 'wait'], done: ['הושלם', 'done'] };
const PAY: Record<string, string> = { scheduled: 'לתשלום', link_created: 'לתשלום', partial: 'שולם חלקית', paid: 'שולם' };
const POST: Record<string, string> = { approved: 'מאושר', scheduled: 'מתוזמן', published: 'פורסם' };

export function Portal({ t, d }: { t: string; d: any }) {
  const r = useRouter();
  const [busy, setBusy] = useState<string | null>(null); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [changes, setChanges] = useState<string | null>(null); const [note, setNote] = useState(''); const [contact, setContact] = useState(''); const [done, setDone] = useState<Record<string, string>>({});
  const act = async (op: string, id: string | null, text = '') => {
    setBusy(op + (id ?? '')); setMsg(null);
    const res = await fetch(`/api/public/portal/${t}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, id, note: text }) }).then((x) => x.json()).catch(() => ({ error: 'אין חיבור — נסו שוב' }));
    setBusy(null);
    if (res.error) { setMsg({ ok: false, t: res.error }); return false; }
    if (id) setDone((x) => ({ ...x, [id]: op }));
    setMsg({ ok: true, t: op === 'approve' ? 'תודה! הפוסט אושר ✓' : op === 'changes' ? 'קיבלנו — נעדכן את הפוסט ונחזור אליכם' : 'ההודעה נשלחה לצוות ✓' });
    setTimeout(() => r.refresh(), 1200); return true;
  };

  const ms: any[] = d.milestones ?? []; const one = ms.filter((x) => x.mode !== 'monthly'); const monthly = ms.filter((x) => x.mode === 'monthly');
  const doneN = ms.filter((x) => x.status === 'done').length; const pct = ms.length ? Math.round((doneN / ms.length) * 100) : 0;
  const next = ms.find((x) => x.status !== 'done');
  const approve: any[] = (d.approve ?? []).filter((x: any) => !done[x.id]);
  const open = (d.payments ?? []).filter((x: any) => x.url); const paid = (d.payments ?? []).filter((x: any) => x.status === 'paid');
  const img = (id: string) => `/api/public/portal/${t}/img/${id}`;
  const months = [...new Set(monthly.map((x) => x.month))].sort().reverse().slice(0, 2);

  return <main className="pt">
    <header className="pt-hero">
      <div className="pt-top"><img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-white-500.webp" alt="Pixel Digital" className="pt-logo" /><span>הפורטל של {d.client.name}</span></div>
      <h1>שלום, {d.client.name} 👋</h1>
      <p>כל מה שקורה אצלנו בשבילכם — במקום אחד, מתעדכן בזמן אמת.</p>
      <div className="pt-stats">
        <a href="#approve" className={approve.length ? 'hot' : ''}><b>{approve.length}</b><span>לאישורכם</span></a>
        <a href="#progress"><b>{pct}%</b><span>התקדמות</span></a>
        <a href="#content"><b>{(d.upcoming ?? []).length}</b><span>פוסטים קרובים</span></a>
        <a href="#pay" className={open.length ? 'warn' : ''}><b>{open.length}</b><span>לתשלום</span></a>
      </div>
    </header>

    {msg && <div className={`pt-toast ${msg.ok ? 'ok' : 'bad'}`} role="status">{msg.t}</div>}

    <section id="approve" className="pt-sec">
      <h2>מחכה לאישור שלכם</h2>
      {approve.length ? <div className="pt-posts">{approve.map((x) => <article key={x.id} className="pt-post">
        {x.img ? <img src={img(x.img)} alt="" loading="lazy" /> : <div className="pt-noimg">❝</div>}
        <div className="pt-post-b">
          <small>{fd(x.due, { weekday: 'long', day: 'numeric', month: 'numeric' })}{(x.platforms ?? []).length ? ` · ${(x.platforms ?? []).join(' · ')}` : ''}</small>
          <b>{x.topic}</b>
          {x.text && <p>{x.text}</p>}{x.hashtags && <em>{Array.isArray(x.hashtags) ? x.hashtags.join(' ') : x.hashtags}</em>}
          {changes === x.id ? <div className="pt-ch"><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="מה תרצו לשנות? (טקסט, תמונה, תאריך…)" rows={3} autoFocus />
            <div className="pt-btns"><button className="pt-btn y" disabled={!!busy || !note.trim()} onClick={async () => { if (await act('changes', x.id, note)) { setChanges(null); setNote(''); } }}>{busy ? 'שולח…' : 'שליחת הבקשה'}</button><button className="pt-btn ghost" onClick={() => setChanges(null)}>ביטול</button></div></div>
            : <div className="pt-btns"><button className="pt-btn y" disabled={!!busy} onClick={() => act('approve', x.id)}>{busy === 'approve' + x.id ? '…' : 'מאשר/ת ✓'}</button><button className="pt-btn ghost" onClick={() => { setChanges(x.id); setNote(''); }}>בקשת שינוי</button></div>}
        </div></article>)}</div>
        : <div className="pt-empty">אין כרגע משהו שמחכה לכם ✓</div>}
    </section>

    <section id="progress" className="pt-sec">
      <h2>ההתקדמות שלנו</h2>
      {ms.length ? <>
        <div className="pt-prog"><div className="pt-bar"><i style={{ width: `${pct}%` }} /></div><span>{doneN} מתוך {ms.length} שלבים הושלמו{next ? ` · הבא: ${next.title}` : ''}</span></div>
        {one.length > 0 && <ol className="pt-tl">{one.map((x) => { const s = MS[x.status] ?? [x.status, 'todo'];
          return <li key={x.id} className={s[1]}><i /><div><b>{x.title}</b><small>{s[0]}{x.due ? ` · ${fd(x.due, { day: 'numeric', month: 'numeric' })}` : ''}{x.needs_client && x.status !== 'done' ? ' · נדרש מכם' : ''}</small></div></li>; })}</ol>}
        {months.map((mo) => <div key={mo} className="pt-month"><h3>{fd(mo, { month: 'long', year: 'numeric' })}</h3>
          <ul>{monthly.filter((x) => x.month === mo).map((x) => { const s = MS[x.status] ?? [x.status, 'todo']; return <li key={x.id} className={s[1]}><i />{x.title}<small>{s[0]}</small></li>; })}</ul></div>)}
      </> : <div className="pt-empty">התוכנית בהכנה — השלבים יופיעו כאן בקרוב.</div>}
    </section>

    <section id="content" className="pt-sec">
      <h2>התוכן הקרוב</h2>
      {(d.upcoming ?? []).length ? <div className="pt-grid">{d.upcoming.map((x: any) => <a key={x.id} className="pt-tile" href={x.url || undefined} target={x.url ? '_blank' : undefined} rel="noreferrer">
        {x.img ? <img src={img(x.img)} alt="" loading="lazy" /> : <div className="pt-noimg">❝</div>}
        <span><b>{x.topic}</b><small>{fd(x.due, { day: 'numeric', month: 'numeric' })} · {POST[x.status] ?? x.status}</small></span></a>)}</div>
        : <div className="pt-empty">עוד אין פוסטים מתוזמנים לשבועות הקרובים.</div>}
    </section>

    {(d.meetings ?? []).length > 0 && <section className="pt-sec"><h2>פגישות קרובות</h2>
      <ul className="pt-list">{d.meetings.map((x: any, i: number) => <li key={i}><b>{x.title}</b><small>{fd(x.start, { weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}{x.location ? ` · ${x.location}` : ''}</small></li>)}</ul></section>}

    <section id="pay" className="pt-sec">
      <h2>תשלומים</h2>
      {open.length ? <ul className="pt-list">{open.map((x: any) => <li key={x.id} className="pay"><div><b>{money(x.amount)}</b><small>{x.title ?? 'תשלום'} · {fd(x.due, { day: 'numeric', month: 'numeric', year: 'numeric' })}</small></div><a className="pt-btn y" href={x.url}>לתשלום מאובטח</a></li>)}</ul>
        : <div className="pt-empty">אין תשלומים פתוחים ✓</div>}
      {paid.length > 0 && <details className="pt-hist"><summary>היסטוריית תשלומים ({paid.length})</summary><ul className="pt-list">{paid.map((x: any) => <li key={x.id}><div><b>{money(x.amount)}</b><small>שולם {fd(x.paid_at, { day: 'numeric', month: 'numeric', year: 'numeric' })}</small></div>{x.invoice ? <a className="pt-btn ghost" href={x.invoice} target="_blank" rel="noreferrer">חשבונית</a> : <span className="pt-chip">{PAY[x.status]}</span>}</li>)}</ul></details>}
    </section>

    <section className="pt-sec pt-contact">
      <h2>משהו לשאול או לבקש?</h2>
      <textarea value={contact} onChange={(e) => setContact(e.target.value)} rows={3} placeholder="כתבו לנו כאן — ההודעה מגיעה ישר לצוות" />
      <button className="pt-btn y" disabled={!!busy || !contact.trim()} onClick={async () => { if (await act('message', null, contact)) setContact(''); }}>{busy === 'message' ? 'שולח…' : 'שליחה לצוות'}</button>
    </section>
    <footer className="pt-foot">Pixel Digital · כיכר בן גוריון 2, קרית טבעון</footer>
  </main>;
}
