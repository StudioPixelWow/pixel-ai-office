'use client';
import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';

type Item = { id: string; version: number; topic: string; idea?: string; post_text?: string; hook?: string; cta?: string; pillar?: string; hashtags: string[]; format?: string; platforms: string[];
  creative_prompt?: string; creative?: string | null; slot_kind?: string; marker?: string | null; due_at: string; status: string; published_url?: string | null; is_winner?: boolean; win_note?: string | null; published_at?: string | null; why?: string | null; review_log?: { at: string; note: string; result?: string }[]; cs?: string | null; cnote?: string | null };
type Marker = { date: string; title: string; kind: string; no_marketing: boolean };

export const STATUS: Record<string, { he: string; cls: string }> = {
  idea: { he: 'רעיון', cls: 's-idea' }, writing: { he: 'בכתיבה', cls: 's-writing' }, design: { he: 'בעיצוב', cls: 's-design' }, pending_approval: { he: 'ממתין לאישורך', cls: 's-pending' },
  approved: { he: 'מאושר', cls: 's-approved' }, scheduled: { he: 'מתוזמן', cls: 's-scheduled' }, published: { he: 'עלה ✓', cls: 's-published' }, not_published: { he: 'לא עלה', cls: 's-missed' },
};
const FLOW = ['idea', 'writing', 'design', 'pending_approval', 'approved', 'scheduled', 'published'];
const NET: Record<string, string> = { facebook: 'f', instagram: 'IG', tiktok: 'TT', linkedin: 'in', youtube: 'YT' };
const DAYS_HE: Record<number, string> = { 1: 'ב׳', 2: 'ב׳ וה׳', 3: 'ב׳, ג׳ וה׳', 4: 'א׳, ב׳, ג׳ וה׳' };
const CS: Record<string, string> = { sent: '👤 אצל הלקוח', approved: '👤 הלקוח אישר ✓', changes: '👤 הלקוח ביקש שינוי' };
const DOW = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const ilDate = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(iso));
const ilTime = (iso: string) => new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
// "not published" is derived: the slot's time has passed and nobody marked it published
const effective = (i: Item) => (i.status !== 'published' && ['approved', 'scheduled'].includes(i.status) && new Date(i.due_at).getTime() < Date.now() - 6 * 3600e3) ? 'not_published' : i.status;
function toIso(day: string, from: string) {
  const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(from));
  const probe = new Date(`${day}T${hhmm}:00Z`); const off = new Date(probe.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })).getTime() - new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  return new Date(probe.getTime() - off).toISOString();
}

export function ContentCalendar({ month, clients, client, markers, items, canEdit }: { month: string; clients: { id: string; name: string; retainer: boolean }[];
  client: { id: string; name: string; logo: string | null; hasDossier: boolean; ppw?: number; brief?: string | null; email?: string | null; contact?: string | null; portal?: string | null } | null; markers: Marker[]; items: Item[]; canEdit: boolean }) {
  const r = useRouter(); const [sel, setSel] = useState<string | null>(null); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState('');
  const ppw = client?.ppw ?? 2; const [review, setReview] = useState(false); const [prefs, setPrefs] = useState(false); const [send, setSend] = useState(false); const [nav2, startNav] = useTransition(); const [copied, setCopied] = useState(false);
  const [y, mo] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1)); const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells = useMemo(() => { const lead = first.getUTCDay(); const n = Math.ceil((lead + days) / 7) * 7;
    return Array.from({ length: n }, (_, k) => { const d = k - lead + 1; return d >= 1 && d <= days ? `${month}-${String(d).padStart(2, '0')}` : null; }); }, [month]);
  const byDay = useMemo(() => { const mp = new Map<string, Item[]>(); for (const i of items) { const k = ilDate(i.due_at); mp.set(k, [...(mp.get(k) ?? []), i]); } return mp; }, [items]);
  const mkDay = useMemo(() => { const mp = new Map<string, Marker[]>(); for (const x of markers) mp.set(x.date, [...(mp.get(x.date) ?? []), x]); return mp; }, [markers]);
  const stat = (k: string) => items.filter((i) => effective(i) === k).length;
  const pending = items.filter((i) => i.status === 'pending_approval');
  const today = ilDate(new Date().toISOString());
  const nav = (m: string) => `?m=${m}${client ? `&client=${client.id}` : ''}`;
  const prev = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7), next = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
  const monthHe = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  const drag = useRef<string | null>(null);

  async function run(key: string, f: () => Promise<any>, ok?: string) {
    setBusy(key); setMsg(null);
    try { const d = await f(); if (ok || d?.note) setMsg({ ok: true, t: ok ?? d.note }); r.refresh(); return d; } catch (e) { setMsg({ ok: false, t: heError(e) }); } finally { setBusy(''); }
  }
  const plan = () => run('plan', async () => {
    const res = await fetch('/api/content/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: client!.id, month }) });
    const j = await res.json(); if (!res.ok) throw new Error(j.error); if (j.request_id) r.push(`/room/${j.request_id}`); return j;
  });
  const move = (id: string, day: string) => { const it = items.find((x) => x.id === id); if (!it || ilDate(it.due_at) === day) return;
    const mk = mkDay.get(day) ?? []; if (mk.some((x) => x.no_marketing)) { setMsg({ ok: false, t: `${day}: ${mk.find((x) => x.no_marketing)!.title} — יום ללא שיווק` }); return; }
    if (new Date(day + 'T12:00:00Z').getUTCDay() === 6) { setMsg({ ok: false, t: 'שבת — אין פרסום' }); return; }
    run('move', () => callAction('move_content_item', { id, due_at: toIso(day, it.due_at), version: it.version }), 'המועד עודכן'); };

  const cur = items.find((i) => i.id === sel) ?? null;
  return <div className="cg">
    <div className="cg-head">
      <div className="cg-title"><small>גאנט תוכן סושיאל</small><h1>{client?.name ?? 'בחר לקוח'}</h1>
        <div className="cg-month"><a className="btn sm ghost" href={nav(prev)}>‹</a><b>{monthHe}</b><a className="btn sm ghost" href={nav(next)}>›</a></div></div>
      <div className="cg-stats">{[['סה״כ', items.length, ''], ['ממתינים', stat('pending_approval'), 's-pending'], ['מאושרים', stat('approved') + stat('scheduled'), 's-approved'], ['עלו', stat('published'), 's-published'], ['לא עלו', stat('not_published'), 's-missed']].map(([l, n, c]) =>
        <div key={l as string} className={`cg-stat ${c}`}><b>{n as number}</b><span>{l as string}</span></div>)}</div>
    </div>

    <div className="cg-bar">
      {clients.length ? <select value={client?.id ?? ''} onChange={(e) => { const v = e.target.value; startNav(() => r.push(`?m=${month}&client=${v}`)); }} aria-label="לקוח" disabled={nav2}>
        {!client && <option value="">בחר לקוח…</option>}
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.retainer ? ' · ריטיינר' : ''}</option>)}</select>
        : <div className="cg-empty"><b>עוד אין לקוחות במערכת</b><span>גאנט תוכן נבנה ללקוח — לקוח נפתח אוטומטית כשליד חותם על הצעה, או ידנית.</span><a className="btn y sm" href="/clients?new=1">＋ לקוח חדש</a><a className="btn sm ghost" href="/leads?new=1">＋ ליד חדש</a></div>}
      {canEdit && client && <>
        <button className="btn" onClick={() => setPrefs(true)} title="תדירות פרסום, מטרות, יעדים והערות שהגאנט נבנה לפיהם">🎯 מטרות והגדרות גאנט</button>
        <label className="cg-ppw" title="כמה פוסטים בשבוע ללקוח הזה. חגים ו-RTM מקבלים את היום שלהם בנוסף">📅
          <select value={ppw} disabled={!!busy || nav2} onChange={(e) => { const n = Number(e.target.value);
            run('ppw', async () => { const x = await callAction('set_content_prefs', { client_id: client.id, posts_per_week: n }); const rs = x?.reslot ?? {};
              return { note: [`עודכן ל-${n} בשבוע (ימי ${DAYS_HE[n]})`, rs.moved ? `${rs.moved} פוסטים הוזזו` : '', rs.banked ? `${rs.banked} עודפים לבנק` : '', rs.restored ? `${rs.restored} הוחזרו מהבנק` : '', x?.filling ? `נכתבים ${x.filling} פוסטים חדשים` : ''].filter(Boolean).join(' · ') }; }); }}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} בשבוע · ימי {DAYS_HE[n]}</option>)}</select></label>
        {client.brief && <span className="badge ok" title={client.brief}>🎯 יש מטרות לגאנט</span>}
        <button className="btn y" disabled={!!busy} onClick={plan}>{busy === 'plan' ? 'מתחיל…' : items.length ? 'בנה מחדש את החודש' : 'צור גאנט לחודש'}</button>
        {client.portal && <button className="btn" title={`הקישור האישי של ${client.name}: גאנט לאישור, התקדמות ותשלומים`} onClick={() => { navigator.clipboard?.writeText(client.portal!); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? '✓ הקישור הועתק' : '🔗 העתקת קישור ללקוח'}</button>}
        {items.length > 0 && <button className="btn" onClick={() => setSend(true)} title="שליחת הפוסטים שאישרת ללקוח לאישור בפורטל">📤 לאישור הלקוח{(() => { const n = items.filter((i) => ['approved', 'scheduled'].includes(i.status) && (!i.cs || i.cs === 'changes') && new Date(i.due_at) > new Date()).length; return n ? ` (${n})` : ''; })()}</button>}
        {items.length > 0 && <button className="btn" onClick={() => setReview(true)}>📝 סקירה והערות ({items.length})</button>}
        {pending.length > 0 && <button className="btn c" disabled={!!busy} onClick={() => run('appr', () => callAction('content_set_status', { ids: pending.map((p) => p.id), status: 'approved' }), `${pending.length} פוסטים אושרו`)}>אשר את כל החודש ({pending.length})</button>}
      </>}
      {nav2 && <span className="badge" role="status">טוען את הלקוח…</span>}
      {client && !client.hasDossier && <span className="badge warn">אין עדיין תיק מותג — הפוסטים ייכתבו בלי כיול שפה. מומלץ להריץ מחקר לקוח קודם.</span>}
      {msg && <span className={`badge ${msg.ok ? 'ok' : 'bad'}`} role="status">{msg.t}</span>}
    </div>

    <div className="cg-legend">{['pending_approval', 'approved', 'scheduled', 'published', 'not_published'].map((k) => <span key={k} className={`cg-dot ${STATUS[k].cls}`}>{STATUS[k].he}</span>)}
      <span className="cg-dot mk">חג / יום מיוחד</span><span className="cg-dot nomkt">ללא שיווק</span></div>

    <div className={`cg-grid${nav2 ? ' cg-loading' : ''}`} role="grid" aria-label={`לוח תוכן ${monthHe}`}>
      {DOW.map((d) => <div key={d} className="cg-dow">{d}</div>)}
      {cells.map((day, k) => {
        if (!day) return <div key={k} className="cg-cell off" />;
        const its = byDay.get(day) ?? []; const mk = mkDay.get(day) ?? []; const sat = new Date(day + 'T12:00:00Z').getUTCDay() === 6; const nomkt = mk.some((x) => x.no_marketing);
        return <div key={k} className={`cg-cell ${sat ? 'sat' : ''} ${nomkt ? 'nomkt' : ''} ${day === today ? 'today' : ''}`}
          onDragOver={(e) => { if (canEdit) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (drag.current) move(drag.current, day); drag.current = null; }}>
          <div className="cg-date"><b>{Number(day.slice(8))}</b>{sat && <small>שבת</small>}</div>
          {mk.map((x) => <div key={x.title} className={`cg-mk ${x.no_marketing ? 'nomkt' : x.kind}`} title={x.title}>{x.no_marketing ? '🕯 ' : x.kind === 'special' ? '★ ' : '✡ '}{x.title}</div>)}
          {its.map((i) => { const st = effective(i);
            return <button key={i.id} className={`cg-post ${STATUS[st]?.cls ?? ''} ${sel === i.id ? 'on' : ''}`} draggable={canEdit} onDragStart={() => { drag.current = i.id; }} onClick={() => setSel(i.id)}>
              {i.creative ? <img src={`/api/files/${i.creative}`} alt="" loading="lazy" /> : <span className="cg-noimg">{i.format?.includes('רילס') ? '▶' : '❝'}</span>}
              <span className="cg-pt"><b>{i.topic}</b><small>{i.format ?? 'פוסט'} · {ilTime(i.due_at)}</small>
                <span className="cg-meta"><i className={`cg-st ${STATUS[st]?.cls}`}>{STATUS[st]?.he}</i>{i.cs && <i className={`cg-cs ${i.cs}`} title={i.cnote ?? ''}>{CS[i.cs]}</i>}{i.platforms.map((p) => <em key={p}>{NET[p] ?? p}</em>)}</span></span>
            </button>; })}
        </div>; })}
    </div>

    {prefs && client && <GanttPrefs client={client} month={month} hasItems={items.some((i) => ['idea', 'writing', 'pending_approval'].includes(i.status))} onClose={() => { setPrefs(false); r.refresh(); }} />}
    {send && client && <ClientSend client={client} month={month} monthHe={monthHe} items={items} onClose={() => { setSend(false); r.refresh(); }} />}
    {review && client && <ReviewBoard items={[...items].sort((a, b) => a.due_at.localeCompare(b.due_at))} clientName={client.name} onClose={() => { setReview(false); r.refresh(); }} />}
    {cur && <PostDrawer key={cur.id} item={cur} client={client!} canEdit={canEdit} onClose={() => setSel(null)} run={run} busy={busy} />}
  </div>;
}

function PostDrawer({ item, client, canEdit, onClose, run, busy }: { item: Item; client: { name: string; logo: string | null }; canEdit: boolean; onClose: () => void;
  run: (k: string, f: () => Promise<any>, ok?: string) => Promise<any>; busy: string }) {
  const [f, setF] = useState({ topic: item.topic ?? '', idea: item.idea ?? '', post_text: item.post_text ?? '', hashtags: (item.hashtags ?? []).join(' '), creative_prompt: item.creative_prompt ?? '' });
  const [url, setUrl] = useState(item.published_url ?? ''); const [winNote, setWinNote] = useState(item.win_note ?? ''); const fileRef = useRef<HTMLInputElement>(null);
  const st = effective(item); const dirty = f.topic !== (item.topic ?? '') || f.idea !== (item.idea ?? '') || f.post_text !== (item.post_text ?? '') || f.hashtags !== (item.hashtags ?? []).join(' ') || f.creative_prompt !== (item.creative_prompt ?? '');
  const save = () => run('save', () => callAction('update_content_item', { id: item.id, topic: f.topic, idea: f.idea, post_text: f.post_text, creative_prompt: f.creative_prompt,
    hashtags: f.hashtags.split(/\s+/).filter(Boolean).map((h) => (h.startsWith('#') ? h : `#${h}`)) }), 'נשמר');
  const status = (s: string) => run('st' + s, () => callAction('content_set_status', { ids: [item.id], status: s }), `סטטוס: ${STATUS[s].he}`);
  const creative = (body: any) => run('cr', async () => { const res = await fetch(`/api/content/${item.id}/creative`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json(); if (!res.ok) throw new Error(j.error); return j; }, 'הקריאייטיב עודכן');
  const upload = (file?: File) => { if (!file) return; const rd = new FileReader(); rd.onload = () => creative({ mode: 'upload', mime: file.type, b64: String(rd.result).split(',')[1] }); rd.readAsDataURL(file); };
  const when = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(item.due_at));
  return <aside className="cg-drawer" role="dialog" aria-label="פוסט">
    <div className="cg-dhead"><div><small>{when}{item.marker ? ` · ${item.marker}` : ''}</small><h2>{item.topic}</h2></div><button className="btn sm ghost" onClick={onClose} aria-label="סגור">✕</button></div>
    <div className="cg-flow">{FLOW.map((s) => <span key={s} className={`${s === st ? 'on' : ''} ${FLOW.indexOf(s) < FLOW.indexOf(st) ? 'past' : ''}`}>{STATUS[s].he}</span>)}{st === 'not_published' && <span className="on missed">לא עלה</span>}</div>

    <div className="cg-mock">
      <div className="cg-mock-h">{client.logo ? <img src={client.logo} alt="" /> : <i>{client.name[0]}</i>}<div><b>{client.name}</b><small>{item.platforms.map((p) => ({ facebook: 'פייסבוק', instagram: 'אינסטגרם', tiktok: 'טיקטוק' } as any)[p] ?? p).join(' · ') || 'רשתות'} · {item.format ?? 'פוסט'}</small></div></div>
      <p className="cg-mock-t">{f.post_text || 'טקסט הפוסט יופיע כאן'}</p>
      {f.hashtags && <p className="cg-mock-tags">{f.hashtags}</p>}
      <div className={`cg-mock-img ${/סטורי|רילס/.test(item.format ?? '') ? 'tall' : ''}`}>{item.creative ? <img src={`/api/files/${item.creative}`} alt="קריאייטיב" /> : <div><span>אין עדיין קריאייטיב</span>{f.creative_prompt && <small dir="ltr">{f.creative_prompt.slice(0, 160)}</small>}</div>}</div>
    </div>

    {canEdit && <>
      <div className="row cg-actions">
        <button className="btn y sm" disabled={!!busy} onClick={() => creative({ mode: 'generate', prompt: f.creative_prompt })}>{busy === 'cr' ? 'יוצר קריאייטיב…' : item.creative ? 'צור קריאייטיב חדש' : 'צור קריאייטיב'}</button>
        <a className="btn sm" target="_blank" rel="noreferrer" title="נפתח בכרום שלך על חשבון מנוי ChatGPT — שמור את התמונה והעלה אותה כאן"
          href={`https://chatgpt.com/?q=${encodeURIComponent(`Create one ${/סטורי|רילס/.test(item.format ?? '') ? 'vertical 4:5' : 'square 1:1'} social media image for "${client.name}". ${f.creative_prompt || f.idea || f.topic}. Premium, scroll-stopping, no text, no letters, no logos, no watermark.`)}`}>צור ב-ChatGPT ↗</a>
        <button className="btn sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>העלה תמונה/עיצוב</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      <label className="cg-f">כותרת<input value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} /></label>
      <label className="cg-f">רעיון<textarea rows={2} value={f.idea} onChange={(e) => setF({ ...f, idea: e.target.value })} /></label>
      <label className="cg-f">טקסט לפוסט<textarea rows={7} value={f.post_text} onChange={(e) => setF({ ...f, post_text: e.target.value })} /></label>
      <label className="cg-f">האשטגים<input value={f.hashtags} onChange={(e) => setF({ ...f, hashtags: e.target.value })} /></label>
      <label className="cg-f">הנחיה לקריאייטיב<textarea dir="ltr" rows={2} value={f.creative_prompt} onChange={(e) => setF({ ...f, creative_prompt: e.target.value })} /></label>
      {item.why && <p className="small muted">למה הפוסט הזה: {item.why}</p>}
      <div className="row cg-actions">
        <button className="btn sm" disabled={!dirty || !!busy} onClick={save}>{busy === 'save' ? 'שומר…' : 'שמור שינויים'}</button>
        {['idea', 'writing', 'design', 'pending_approval'].includes(item.status) && <button className="btn c sm" disabled={!!busy} onClick={() => status('approved')}>אשר פוסט</button>}
        {item.status === 'approved' && <button className="btn sm" disabled={!!busy} onClick={() => status('scheduled')}>סמן כמתוזמן</button>}
        {item.status !== 'pending_approval' && !['published'].includes(item.status) && <button className="btn sm ghost" disabled={!!busy} onClick={() => status('pending_approval')}>החזר לאישור</button>}
      </div>
      <div className="cg-pub">
        <b>{item.status === 'published' ? `עלה ✓ ${item.published_at ? new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(item.published_at)) : ''}` : 'אחרי שהפוסט עלה'}</b>
        <div className="row"><input dir="ltr" placeholder="https://… קישור לפוסט שעלה" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn sm y" disabled={!!busy} onClick={() => run('pub', () => callAction('content_mark_published', { id: item.id, url: url.trim() }), 'סומן שעלה')}>סמן שעלה</button>
          {item.status !== 'published' && <button className="btn sm ghost" disabled={!!busy} onClick={() => status('not_published')}>לא עלה</button>}</div>
        {item.published_url && <a className="small" href={item.published_url} target="_blank" rel="noreferrer" dir="ltr">{item.published_url}</a>}
      </div>
      {item.status === 'published' && <div className={`cg-win ${item.is_winner ? 'on' : ''}`}>
        <b>{item.is_winner ? '⭐ פוסט מנצח' : 'הפוסט הצליח במיוחד?'}</b>
        <small>פוסטים מנצחים נכנסים להקשר של הסוכנים — הם לומדים מה עובד אצל הלקוח.</small>
        {!item.is_winner && <input placeholder="למה הוא הצליח? (למשל: הוק שאלה, וידאו קצר, 3× מעורבות)" value={winNote} onChange={(e) => setWinNote(e.target.value)} />}
        <button className={`btn sm ${item.is_winner ? 'ghost' : 'y'}`} disabled={!!busy} onClick={() => run('win', () => callAction('content_winner', { id: item.id, on: !item.is_winner, note: winNote }), item.is_winner ? 'הוסר מהמנצחים' : '⭐ נשמר כפוסט מנצח')}>{item.is_winner ? 'הסר מהמנצחים' : '⭐ סמן כמנצח'}</button>
      </div>}
    </>}
  </aside>;
}

// Review round: see the whole month in one scroll, approve some, comment on others — the copywriter rewrites the commented posts to match.
function ReviewBoard({ items, clientName, onClose }: { items: Item[]; clientName: string; onClose: () => void }) {
  const [dec, setDec] = useState<Record<string, 'ok' | 'note' | undefined>>({}); const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [done, setDone] = useState<Record<string, string>>({});
  const okIds = items.filter((i) => dec[i.id] === 'ok').map((i) => i.id);
  const noteList = items.filter((i) => dec[i.id] === 'note' && (notes[i.id] ?? '').trim()).map((i) => ({ id: i.id, note: notes[i.id].trim() }));
  const allOk = () => setDec(Object.fromEntries(items.filter((i) => !['published', 'approved', 'scheduled'].includes(i.status)).map((i) => [i.id, dec[i.id] === 'note' ? 'note' : 'ok'])));
  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      if (okIds.length) await callAction('content_set_status', { ids: okIds, status: 'approved' });
      let note = '';
      if (noteList.length) { const x = await callAction('content_request_changes', { items: noteList }); note = x?.note ?? ''; }
      const d: Record<string, string> = {}; okIds.forEach((id) => (d[id] = 'אושר ✓')); noteList.forEach((x) => (d[x.id] = '✍️ קליופי כותבת פוסט חדש לפי ההערה — יחזור לגאנט לאישורך')); setDone(d);
      setMsg({ ok: true, t: `${okIds.length ? `${okIds.length} אושרו. ` : ''}${note}` });
      setDec({}); setNotes({});
    } catch (e) { setMsg({ ok: false, t: heError(e) }); } finally { setBusy(false); }
  };
  const d = (iso: string) => new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(iso));
  return <div className="rv-back" role="dialog" aria-modal="true" aria-label="סקירת החודש">
    <div className="rv">
      <div className="rv-h"><div className="sp"><small>סקירת גאנט</small><h2>{clientName} · {items.length} פוסטים</h2></div>
        <button className="btn sm" onClick={allOk} disabled={busy}>✓ סמן הכל לאישור</button><button className="btn sm ghost" onClick={onClose} disabled={busy}>סגירה</button></div>
      <div className="rv-list">{items.map((i) => { const st = dec[i.id]; const locked = ['published', 'scheduled'].includes(i.status);
        return <article key={i.id} className={`rv-card ${st ?? ''}`}>
          <div className="rv-side">{i.creative ? <img src={`/api/files/${i.creative}`} alt="" loading="lazy" /> : <span className="cg-noimg">{i.format?.includes('רילס') ? '▶' : '❝'}</span>}
            <b>{d(i.due_at)}</b><small>{i.format ?? 'פוסט'}</small><i className={`cg-st ${STATUS[i.status]?.cls}`}>{STATUS[i.status]?.he ?? i.status}</i></div>
          <div className="rv-body"><h3>{i.topic}</h3>{i.hook && <p className="rv-hook">{i.hook}</p>}
            {i.post_text ? <p className="rv-text">{i.post_text}</p> : i.idea ? <p className="rv-text muted">{i.idea}</p> : null}
            {i.cta && <p className="small"><b>CTA:</b> {i.cta}</p>}{(i.hashtags ?? []).length > 0 && <p className="small rv-tags" dir="auto">{i.hashtags.join(' ')}</p>}
            {(i.review_log ?? []).length > 0 && <details className="small"><summary>היסטוריית הערות ({i.review_log!.length})</summary>{i.review_log!.map((x, k) => <p key={k}>• {x.note}</p>)}</details>}
            {done[i.id] ? <p className="rv-done">{done[i.id]}</p> : !locked && <>
              <div className="rv-act"><button className={`btn sm ${st === 'ok' ? 'c' : 'ghost'}`} disabled={busy} onClick={() => setDec({ ...dec, [i.id]: st === 'ok' ? undefined : 'ok' })}>✓ מאשר</button>
                <button className={`btn sm ${st === 'note' ? 'y' : 'ghost'}`} disabled={busy} onClick={() => setDec({ ...dec, [i.id]: st === 'note' ? undefined : 'note' })}>💬 הערה לתיקון</button></div>
              {st === 'note' && <textarea rows={2} autoFocus value={notes[i.id] ?? ''} onChange={(e) => setNotes({ ...notes, [i.id]: e.target.value })} placeholder="מה לשנות? למשל: פחות רשמי, להוסיף את המבצע של החודש, לקצר לשתי שורות, לשנות לרילס" />}</>}
          </div></article>; })}</div>
      <div className="rv-foot">{msg && <span className={`badge ${msg.ok ? 'ok' : 'bad'}`}>{msg.t}</span>}<span className="sp" />
        <span className="small muted">{okIds.length} לאישור · {noteList.length} עם הערות</span>
        <button className="btn y" disabled={busy || (!okIds.length && !noteList.length)} onClick={submit}>{busy ? 'שולח…' : `שליחה${noteList.length ? ' ותיקון' : ''}`}</button></div>
    </div></div>;
}

// Per-client gantt settings: 1–4 posts a week (Monday & Thursday first) + goals/targets/notes the planner and writers must follow.
function GanttPrefs({ client, month, hasItems, onClose }: { client: { id: string; name: string; ppw?: number; brief?: string | null }; month: string; hasItems: boolean; onClose: () => void }) {
  const [ppw, setPpw] = useState(client.ppw ?? 2); const [brief, setBrief] = useState(client.brief ?? ''); const [applyNow, setApplyNow] = useState(false);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const changed = ppw !== (client.ppw ?? 2); const briefChanged = brief.trim() !== (client.brief ?? '').trim();
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const x = await callAction('set_content_prefs', { client_id: client.id, posts_per_week: ppw, brief, apply_existing: applyNow, month });
      const rs = x?.reslot ?? {}; const parts: string[] = ['נשמר'];
      if (x?.changed) parts.push(`${rs.moved ?? 0} פוסטים הוזזו לימי ${DAYS_HE[ppw]}`);
      if (rs.banked) parts.push(`${rs.banked} עודפים הועברו לבנק הפוסטים`);
      if (rs.restored) parts.push(`${rs.restored} הוחזרו מהבנק`);
      if (x?.filling) parts.push(`הסוכנים כותבים ${x.filling} פוסטים חדשים למשבצות שנוספו`);
      if (x?.revised) parts.push(`${x.revised} פוסטים שעוד לא אושרו נכתבים מחדש לפי המטרות`);
      setMsg({ ok: true, t: parts.join(' · ') });
    } catch (e) { setMsg({ ok: false, t: heError(e) }); } finally { setBusy(false); }
  };
  return <div className="rv-back" role="dialog" aria-modal="true" aria-label="מטרות והגדרות גאנט">
    <div className="rv gp">
      <div className="rv-h"><div className="sp"><small>מטרות והגדרות גאנט</small><h2>{client.name}</h2></div><button className="btn sm ghost" onClick={onClose} disabled={busy}>סגירה</button></div>
      <div className="gp-body">
        <section><h3>כמה פוסטים בשבוע?</h3>
          <div className="gp-seg" role="radiogroup">{[1, 2, 3, 4].map((n) => <button key={n} type="button" role="radio" aria-checked={ppw === n} className={ppw === n ? 'on' : ''} onClick={() => setPpw(n)}><b>{n}</b><small>ימי {DAYS_HE[n]}</small></button>)}</div>
          <p className="small muted">העדיפות היא ימי שני וחמישי. פוסטים של חג, יום מיוחד או RTM מקבלים את היום שלהם בנוסף. אף פעם לא שני פוסטים באותו יום.</p>
          {changed && <p className="small gp-warn">בשמירה: כל הפוסטים העתידיים שעוד לא עלו יעברו לימים החדשים. אם יש עודף, הוא עובר לבנק הפוסטים (לא נמחק). אם חסר, קודם יחזרו פוסטים מהבנק, ואז הסוכנים יכתבו פוסטים חדשים למשבצות הריקות.</p>}
        </section>
        <section><h3>מטרות, יעדים והערות לגאנט</h3>
          <textarea rows={7} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={'למשל:\n• יעד החודש: 30 פניות לליסינג\n• לדחוף את המבצע של נובמבר עד ה-20\n• פחות פוסטים כלליים, יותר תוצאות ולקוחות אמיתיים\n• לא להזכיר מחירים'} />
          <p className="small muted">כל גאנט שנבנה ללקוח הזה, ידני או אוטומטי, וכל פוסט שנכתב מחדש, יתחשבו במה שכתוב כאן.</p>
          {hasItems && brief.trim() && <label className="gp-check"><input type="checkbox" checked={applyNow} onChange={(e) => setApplyNow(e.target.checked)} />
            <span>להחיל גם על הפוסטים שכבר בגאנט החודש ועוד לא אושרו. הסוכנת תכתוב אותם מחדש באותו תאריך, והם יחזרו לאישורך.</span></label>}
        </section>
      </div>
      <div className="rv-foot">{msg && <span className={`badge ${msg.ok ? 'ok' : 'bad'}`} role="status">{msg.t}</span>}<span className="sp" />
        <button className="btn y" disabled={busy || (!changed && !briefChanged && !applyNow)} onClick={save}>{busy ? 'שומר ומעדכן…' : 'שמירה ועדכון הגאנט'}</button></div>
    </div></div>;
}

// Send the month to the client: only posts Tal approved go to the portal; the client approves or comments there.
function ClientSend({ client, month, monthHe, items, onClose }: { client: { id: string; name: string; email?: string | null; contact?: string | null }; month: string; monthHe: string; items: Item[]; onClose: () => void }) {
  const future = items.filter((i) => new Date(i.due_at) > new Date());
  const ready = future.filter((i) => ['approved', 'scheduled'].includes(i.status) && (!i.cs || i.cs === 'changes'));
  const notYet = future.filter((i) => ['idea', 'writing', 'design', 'pending_approval'].includes(i.status));
  const atClient = items.filter((i) => i.cs === 'sent').length, okd = items.filter((i) => i.cs === 'approved').length, chg = items.filter((i) => i.cs === 'changes').length;
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [link, setLink] = useState<string | null>(null); const [copied, setCopied] = useState(false);
  const [to, setTo] = useState(client.email ?? ''); const [subject, setSubject] = useState(`גאנט התוכן ל${monthHe} מחכה לאישורך`);
  const [body, setBody] = useState('');
  const go = async () => { setBusy('send'); setMsg(null);
    try { const x = await callAction('content_send_client', { client_id: client.id, month }); setLink(x.link);
      setBody(`היי${client.contact ? ' ' + client.contact : ''},\n\nגאנט התוכן ל${monthHe} מוכן ומחכה לאישורך.\nבקישור תראו את כל הפוסטים של החודש לפי תאריכים, ותוכלו לאשר הכל בלחיצה אחת או להשאיר הערה על פוסט מסוים, ואנחנו נתקן:\n${x.link}\n\nתודה!`);
      setMsg({ ok: true, t: x.sent ? `${x.sent} פוסטים נשלחו לפורטל של הלקוח` : 'הפוסטים כבר אצל הלקוח' }); }
    catch (e) { setMsg({ ok: false, t: heError(e) }); } finally { setBusy(''); } };
  const mail = async () => { setBusy('mail'); setMsg(null);
    try { const res = await fetch(`/api/clients/${client.id}/email`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to, subject, body }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error); setMsg({ ok: true, t: `המייל נשלח ל-${to} ✓` }); }
    catch (e) { setMsg({ ok: false, t: heError(e) }); } finally { setBusy(''); } };
  return <div className="rv-back" role="dialog" aria-modal="true" aria-label="שליחה לאישור הלקוח">
    <div className="rv gp">
      <div className="rv-h"><div className="sp"><small>שליחת גאנט לאישור הלקוח</small><h2>{client.name} · {monthHe}</h2></div><button className="btn sm ghost" onClick={onClose} disabled={!!busy}>סגירה</button></div>
      <div className="gp-body">
        <div className="cs-stats"><div><b>{ready.length}</b><span>מוכנים לשליחה</span></div><div><b>{atClient}</b><span>אצל הלקוח</span></div><div><b>{okd}</b><span>הלקוח אישר</span></div><div><b>{chg}</b><span>ביקש שינוי</span></div></div>
        <p className="small muted">נשלחים רק פוסטים שאתה אישרת. טיוטות לא מגיעות ללקוח. בפורטל הלקוח רואה את החודש לפי תאריכים, מאשר הכל או פוסט-פוסט, ויכול להשאיר הערה. הערה של הלקוח עוברת ישר לסוכנת התיקונים, והפוסט המתוקן חוזר קודם אליך.</p>
        {notYet.length > 0 && <p className="small gp-warn">{notYet.length} פוסטים בחודש עוד לא אושרו על ידך, ולכן לא יישלחו. אפשר לאשר אותם ב״סקירה והערות״ ולשלוח שוב.</p>}
        {!link ? <button className="btn y" disabled={!!busy || (!ready.length && !atClient)} onClick={go}>{busy === 'send' ? 'שולח…' : ready.length ? `📤 שליחת ${ready.length} פוסטים לאישור הלקוח` : 'הצגת הקישור לפורטל'}</button>
        : <>
          <section><h3>הקישור ללקוח</h3><div className="cs-link"><span dir="ltr">{link.replace(/^https?:\/\//, '')}</span>
            <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'הועתק ✓' : 'העתקה'}</button>
            <a className="btn sm ghost" href={link} target="_blank" rel="noreferrer">תצוגה ↗</a></div></section>
          <section><h3>שליחה במייל</h3>
            <label className="cs-f">אל<input dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" /></label>
            <label className="cs-f">נושא<input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
            <label className="cs-f">תוכן<textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} /></label>
            <button className="btn y" disabled={!!busy || !to.trim()} onClick={mail}>{busy === 'mail' ? 'שולח…' : '✉ שליחת המייל ללקוח'}</button>
            <p className="small muted">המייל יוצא מ-office@ בעיצוב ועם החתימה, רק בלחיצה שלך.</p></section></>}
      </div>
      <div className="rv-foot">{msg && <span className={`badge ${msg.ok ? 'ok' : 'bad'}`} role="status">{msg.t}</span>}<span className="sp" /></div>
    </div></div>;
}
