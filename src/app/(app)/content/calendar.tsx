'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';

type Item = { id: string; version: number; topic: string; idea?: string; post_text?: string; hook?: string; cta?: string; pillar?: string; hashtags: string[]; format?: string; platforms: string[];
  creative_prompt?: string; creative?: string | null; slot_kind?: string; marker?: string | null; due_at: string; status: string; published_url?: string | null; published_at?: string | null; why?: string | null };
type Marker = { date: string; title: string; kind: string; no_marketing: boolean };

export const STATUS: Record<string, { he: string; cls: string }> = {
  idea: { he: 'רעיון', cls: 's-idea' }, writing: { he: 'בכתיבה', cls: 's-writing' }, design: { he: 'בעיצוב', cls: 's-design' }, pending_approval: { he: 'ממתין לאישורך', cls: 's-pending' },
  approved: { he: 'מאושר', cls: 's-approved' }, scheduled: { he: 'מתוזמן', cls: 's-scheduled' }, published: { he: 'עלה ✓', cls: 's-published' }, not_published: { he: 'לא עלה', cls: 's-missed' },
};
const FLOW = ['idea', 'writing', 'design', 'pending_approval', 'approved', 'scheduled', 'published'];
const NET: Record<string, string> = { facebook: 'f', instagram: 'IG', tiktok: 'TT', linkedin: 'in', youtube: 'YT' };
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
  client: { id: string; name: string; logo: string | null; hasDossier: boolean } | null; markers: Marker[]; items: Item[]; canEdit: boolean }) {
  const r = useRouter(); const [sel, setSel] = useState<string | null>(null); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState('');
  const [ppw, setPpw] = useState(3);
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
    const res = await fetch('/api/content/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: client!.id, month, posts_per_week: ppw }) });
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
      <div className="cg-stats">{[['סה״כ', items.length, ''], ['ממתינים לאישור', stat('pending_approval'), 's-pending'], ['מאושרים', stat('approved') + stat('scheduled'), 's-approved'], ['עלו', stat('published'), 's-published'], ['לא עלו', stat('not_published'), 's-missed']].map(([l, n, c]) =>
        <div key={l as string} className={`cg-stat ${c}`}><b>{n as number}</b><span>{l as string}</span></div>)}</div>
    </div>

    <div className="cg-bar">
      <select value={client?.id ?? ''} onChange={(e) => r.push(`?m=${month}&client=${e.target.value}`)} aria-label="לקוח">
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.retainer ? ' · ריטיינר' : ''}</option>)}</select>
      {canEdit && client && <>
        <label className="cg-ppw">פוסטים בשבוע<select value={ppw} onChange={(e) => setPpw(Number(e.target.value))}>{[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <button className="btn y" disabled={!!busy} onClick={plan}>{busy === 'plan' ? 'מתחיל…' : items.length ? 'בנה מחדש את החודש' : 'צור גאנט לחודש'}</button>
        {pending.length > 0 && <button className="btn c" disabled={!!busy} onClick={() => run('appr', () => callAction('content_set_status', { ids: pending.map((p) => p.id), status: 'approved' }), `${pending.length} פוסטים אושרו`)}>אשר את כל החודש ({pending.length})</button>}
      </>}
      {client && !client.hasDossier && <span className="badge warn">אין עדיין תיק מותג — הפוסטים ייכתבו בלי כיול שפה. מומלץ להריץ מחקר לקוח קודם.</span>}
      {msg && <span className={`badge ${msg.ok ? 'ok' : 'bad'}`} role="status">{msg.t}</span>}
    </div>

    <div className="cg-legend">{['pending_approval', 'approved', 'scheduled', 'published', 'not_published'].map((k) => <span key={k} className={`cg-dot ${STATUS[k].cls}`}>{STATUS[k].he}</span>)}
      <span className="cg-dot mk">חג / יום מיוחד</span><span className="cg-dot nomkt">ללא שיווק</span></div>

    <div className="cg-grid" role="grid" aria-label={`לוח תוכן ${monthHe}`}>
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
                <span className="cg-meta"><i className={`cg-st ${STATUS[st]?.cls}`}>{STATUS[st]?.he}</i>{i.platforms.map((p) => <em key={p}>{NET[p] ?? p}</em>)}</span></span>
            </button>; })}
        </div>; })}
    </div>

    {cur && <PostDrawer key={cur.id} item={cur} client={client!} canEdit={canEdit} onClose={() => setSel(null)} run={run} busy={busy} />}
  </div>;
}

function PostDrawer({ item, client, canEdit, onClose, run, busy }: { item: Item; client: { name: string; logo: string | null }; canEdit: boolean; onClose: () => void;
  run: (k: string, f: () => Promise<any>, ok?: string) => Promise<any>; busy: string }) {
  const [f, setF] = useState({ topic: item.topic ?? '', idea: item.idea ?? '', post_text: item.post_text ?? '', hashtags: (item.hashtags ?? []).join(' '), creative_prompt: item.creative_prompt ?? '' });
  const [url, setUrl] = useState(item.published_url ?? ''); const fileRef = useRef<HTMLInputElement>(null);
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
    </>}
  </aside>;
}
