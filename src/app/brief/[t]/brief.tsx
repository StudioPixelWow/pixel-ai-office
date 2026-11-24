'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { INTAKE_MAX_MB, fmtSize, intakeProgress, sectionProgress, sectionsFor, type IntakeFile, type IntakeQ, type IntakeSection } from '@/lib/intake';

type V = { client_name: string; services: string[]; data: Record<string, any>; files: IntakeFile[]; submitted_at: string | null };
type Up = { tmp: string; section: string; name: string; size: number; pct: number; error?: string };
const icon = (m: string) => m.startsWith('image/') ? '🖼️' : m.startsWith('video/') ? '🎬' : m.includes('pdf') ? '📄' : /zip|rar|7z/.test(m) ? '🗜️' : /font/.test(m) ? '🔤' : /sheet|excel|csv/.test(m) ? '📊' : /presentation|powerpoint|keynote/.test(m) ? '📽️' : '📎';
const uid = () => (crypto as any).randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export function Brief({ t, v, supa }: { t: string; v: V; supa: { url: string; key: string } }) {
  const sections = useMemo(() => sectionsFor(v.services ?? []), [v.services]);
  const [data, setData] = useState<Record<string, any>>(v.data ?? {});
  const [files, setFiles] = useState<IntakeFile[]>(v.files ?? []);
  const [ups, setUps] = useState<Up[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [cur, setCur] = useState<number | 'review' | 'done'>(0);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [submitted, setSubmitted] = useState(!!v.submitted_at);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const timers = useRef<Record<string, any>>({}); const pending = useRef<Record<string, any>>({});
  const top = useRef<HTMLDivElement>(null);
  const pct = intakeProgress(v.services ?? [], data, files);
  const first = (v.client_name ?? '').trim();

  const api = async (body: any) => { const r = await fetch(`/api/public/brief/${t}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? 'שגיאה'); return j; };
  const flush = async (key: string) => { clearTimeout(timers.current[key]); const a = pending.current[key]; if (!a) return; delete pending.current[key];
    setSave('saving'); try { await api({ op: 'save', section: key, answers: a }); setSave('saved'); } catch { setSave('error'); pending.current[key] = a; } };
  const setAnswer = (sec: string, k: string, val: any) => setData((d) => { const next = { ...(d[sec] ?? {}), [k]: val }; pending.current[sec] = next; clearTimeout(timers.current[sec]);
    timers.current[sec] = setTimeout(() => flush(sec), 900); setSave('saving'); return { ...d, [sec]: next }; });
  const flushAll = () => Promise.all(Object.keys(pending.current).map(flush));
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (Object.keys(pending.current).length || ups.some((u) => !u.error)) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [ups]);
  const go = async (to: number | 'review' | 'done') => { await flushAll(); setCur(to); setErr(''); requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };

  const upload = (sec: string, q: string, list: FileList | File[]) => {
    for (const f of Array.from(list)) {
      const tmp = uid(); const section = `${sec}:${q}`;
      if (f.size > INTAKE_MAX_MB * 1048576) { setUps((u) => [...u, { tmp, section, name: f.name, size: f.size, pct: 0, error: `גדול מ-${INTAKE_MAX_MB}MB — אפשר להוסיף קישור לתיקייה בפרק "מדיה וחומרים"` }]); continue; }
      const ext = (f.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
      const path = `${t}/${sec}/${tmp}.${ext}`; const mime = f.type || 'application/octet-stream';
      setUps((u) => [...u, { tmp, section, name: f.name, size: f.size, pct: 0 }]);
      if (mime.startsWith('image/')) setPreviews((p) => ({ ...p, [tmp]: URL.createObjectURL(f) }));
      const x = new XMLHttpRequest(); x.open('POST', `${supa.url}/storage/v1/object/client-intake/${path}`);
      x.setRequestHeader('apikey', supa.key); x.setRequestHeader('x-upsert', 'false'); x.setRequestHeader('content-type', mime); x.setRequestHeader('cache-control', '3600');
      x.upload.onprogress = (e) => { if (e.lengthComputable) setUps((u) => u.map((y) => y.tmp === tmp ? { ...y, pct: Math.round((e.loaded / e.total) * 100) } : y)); };
      x.onerror = () => setUps((u) => u.map((y) => y.tmp === tmp ? { ...y, error: 'ההעלאה נכשלה — בדקו את החיבור ונסו שוב' } : y));
      x.onload = async () => {
        if (x.status >= 300) { setUps((u) => u.map((y) => y.tmp === tmp ? { ...y, error: 'ההעלאה נכשלה — נסו שוב' } : y)); return; }
        try { const r = await api({ op: 'file_add', file: { id: tmp, section, path, name: f.name, size: f.size, mime } }); setFiles(r.files ?? []); setUps((u) => u.filter((y) => y.tmp !== tmp)); setSave('saved'); }
        catch (e: any) { setUps((u) => u.map((y) => y.tmp === tmp ? { ...y, error: e.message } : y)); }
      };
      x.send(f);
    }
  };
  const removeFile = async (f: IntakeFile) => { if (!confirm(`להסיר את "${f.name}"?`)) return; try { const r = await api({ op: 'file_remove', file: { id: f.id } }); setFiles(r.files ?? []); } catch (e: any) { setErr(e.message); } };
  const submit = async () => { setBusy(true); setErr(''); try { await flushAll(); await api({ op: 'submit' }); setSubmitted(true); setCur('done'); top.current?.scrollIntoView({ behavior: 'smooth' }); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };

  const R = 26, C = 2 * Math.PI * R;
  return <main className="bf" dir="rtl">
    <header className="bf-top"><img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-500.webp" alt="Pixel Digital" />
      <span className={`bf-save ${save}`}>{save === 'saving' ? 'שומר…' : save === 'saved' ? '✓ נשמר' : save === 'error' ? '⚠︎ לא נשמר, ננסה שוב' : 'הכול נשמר אוטומטית'}</span></header>
    <section className="bf-hero" ref={top}>
      <div className="bf-hero-txt"><small>תיק האפיון של</small><h1>{first || 'העסק שלכם'}</h1>
        <p>כמה דקות של שיתוף, וחוסכים שעות בשיחה. ספרו לנו על העסק והעלו כל חומר שיש: לוגו, תמונות, סרטונים, מצגות. אפשר למלא בכמה פעמים, הכול נשמר.</p></div>
      <div className="bf-ring" aria-label={`${pct}% הושלם`}><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r={R} className="bg" /><circle cx="32" cy="32" r={R} className="fg" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} /></svg><b>{pct}%</b><span>מולא</span></div>
    </section>
    {submitted && cur !== 'done' && <div className="bf-note">✓ שלחתם לנו את התיק. אפשר להמשיך להוסיף ולעדכן, וזה יתעדכן אצלנו.</div>}

    {cur === 'done' ? <section className="bf-card bf-done"><div className="bf-confetti" aria-hidden>{Array.from({ length: 18 }).map((_, i) => <i key={i} style={{ ['--i' as any]: i }} />)}</div>
      <div className="bf-done-ic">🎉</div><h2>תודה{first ? `, ${first}` : ''}! קיבלנו הכול</h2>
      <p>הצוות שלנו כבר עובר על החומרים, ונגיע לשיחת האפיון מוכנים ועם רעיונות.</p>
      <p className="bf-muted">נזכר/ת במשהו? אפשר לחזור לתיק בכל רגע דרך אותו קישור.</p>
      <button className="bf-btn ghost" onClick={() => go(0)}>חזרה לתיק</button></section>
    : <div className="bf-body">
      <nav className="bf-nav" aria-label="פרקי התיק">{sections.map((s, i) => { const p = sectionProgress(s, data, files); const full = p.done === p.total;
        return <button key={s.key} className={`${cur === i ? 'on' : ''} ${full ? 'full' : p.done ? 'part' : ''}`} onClick={() => go(i)}>
          <span className="e">{full ? '✓' : s.emoji}</span><span className="t">{s.title}</span><span className="c">{p.done}/{p.total}</span></button>; })}
        <button className={`bf-nav-send ${cur === 'review' ? 'on' : ''}`} onClick={() => go('review')}><span className="e">🚀</span><span className="t">סיום ושליחה</span></button></nav>

      <div className="bf-main">{cur === 'review' ? <Review sections={sections} data={data} files={files} pct={pct} onJump={go} onSubmit={submit} busy={busy} submitted={submitted} err={err} />
        : <SectionView key={sections[cur as number].key} s={sections[cur as number]} idx={cur as number} total={sections.length} d={data[sections[cur as number].key] ?? {}}
            files={files} ups={ups} previews={previews} onAnswer={setAnswer} onUpload={upload} onRemove={removeFile} onDismiss={(tmp) => setUps((u) => u.filter((y) => y.tmp !== tmp))}
            onPrev={(cur as number) > 0 ? () => go((cur as number) - 1) : undefined} onNext={() => go((cur as number) < sections.length - 1 ? (cur as number) + 1 : 'review')} last={(cur as number) === sections.length - 1} />}
        {err && cur !== 'review' && <p className="bf-err" role="alert">{err}</p>}</div>
    </div>}
    <footer className="bf-foot">Pixel Digital · הקישור אישי ומאובטח. החומרים נשמרים אצלנו בלבד.</footer>
  </main>;
}

function SectionView({ s, idx, total, d, files, ups, previews, onAnswer, onUpload, onRemove, onDismiss, onPrev, onNext, last }: {
  s: IntakeSection; idx: number; total: number; d: Record<string, any>; files: IntakeFile[]; ups: Up[]; previews: Record<string, string>;
  onAnswer: (sec: string, k: string, v: any) => void; onUpload: (sec: string, q: string, f: FileList | File[]) => void; onRemove: (f: IntakeFile) => void; onDismiss: (tmp: string) => void;
  onPrev?: () => void; onNext: () => void; last: boolean }) {
  return <section className="bf-card">
    <div className="bf-sec-h"><span className="bf-sec-e">{s.emoji}</span><div><small>פרק {idx + 1} מתוך {total}</small><h2>{s.title}</h2><p>{s.intro}</p></div></div>
    <div className="bf-qs">{s.qs.map((q) => <Question key={q.k} s={s} q={q} v={d[q.k]} files={files.filter((f) => f.section === `${s.key}:${q.k}`)} ups={ups.filter((u) => u.section === `${s.key}:${q.k}`)}
      previews={previews} onAnswer={onAnswer} onUpload={onUpload} onRemove={onRemove} onDismiss={onDismiss} />)}</div>
    <div className="bf-pager">{onPrev ? <button className="bf-btn ghost" onClick={onPrev}>→ הקודם</button> : <span />}<button className="bf-btn" onClick={onNext}>{last ? 'לסיום ושליחה' : 'הבא'} ←</button></div>
  </section>;
}

function Question({ s, q, v, files, ups, previews, onAnswer, onUpload, onRemove, onDismiss }: { s: IntakeSection; q: IntakeQ; v: any; files: IntakeFile[]; ups: Up[]; previews: Record<string, string>;
  onAnswer: (sec: string, k: string, v: any) => void; onUpload: (sec: string, q: string, f: FileList | File[]) => void; onRemove: (f: IntakeFile) => void; onDismiss: (tmp: string) => void }) {
  const set = (x: any) => onAnswer(s.key, q.k, x); const [drag, setDrag] = useState(false);
  const id = `q-${s.key}-${q.k}`;
  const head = <label htmlFor={id} className="bf-q-l">{q.label}{q.hint && <small>{q.hint}</small>}</label>;
  if (q.type === 'text') return <div className="bf-q">{head}<input id={id} value={v ?? ''} placeholder={q.placeholder} onChange={(e) => set(e.target.value)} /></div>;
  if (q.type === 'textarea') return <div className="bf-q">{head}<textarea id={id} rows={4} value={v ?? ''} placeholder={q.placeholder} onChange={(e) => set(e.target.value)} /></div>;
  if (q.type === 'chips' || q.type === 'chips1') {
    const sel: string[] = q.type === 'chips' ? (Array.isArray(v) ? v : []) : (v ? [v] : []); const n = q.options!.length;
    const cols = n <= 4 ? n : n % 3 === 0 ? 3 : n % 2 === 0 ? 2 : 1;
    return <div className="bf-q"><span className="bf-q-l">{q.label}{q.hint && <small>{q.hint}</small>}{q.type === 'chips' && <small>אפשר לבחור כמה</small>}</span>
      <div className="bf-chips" style={{ ['--n' as any]: cols, ['--m' as any]: n % 2 === 0 ? 2 : 1 }}>{q.options!.map((o) => { const on = sel.includes(o);
        return <button type="button" key={o} className={on ? 'on' : ''} aria-pressed={on} onClick={() => set(q.type === 'chips' ? (on ? sel.filter((x) => x !== o) : [...sel, o]) : (on ? '' : o))}>{on ? '✓ ' : ''}{o}</button>; })}</div></div>;
  }
  if (q.type === 'links') {
    const list: string[] = Array.isArray(v) && v.length ? v : [''];
    return <div className="bf-q"><span className="bf-q-l">{q.label}{q.hint && <small>{q.hint}</small>}</span>
      <div className="bf-links">{list.map((x, i) => <div key={i} className="bf-link"><input dir="ltr" inputMode="url" placeholder="https://" value={x} onChange={(e) => set(list.map((y, j) => j === i ? e.target.value : y))}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); set([...list, '']); } }} />
        {list.length > 1 && <button type="button" aria-label="הסרה" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>}</div>)}
        <button type="button" className="bf-add" onClick={() => set([...list, ''])}>＋ קישור נוסף</button></div></div>;
  }
  return <div className="bf-q"><span className="bf-q-l">{q.label}{q.hint && <small>{q.hint}</small>}</span>
    <label className={`bf-drop ${drag ? 'drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) onUpload(s.key, q.k, e.dataTransfer.files); }}>
      <input type="file" multiple onChange={(e) => { if (e.target.files?.length) onUpload(s.key, q.k, e.target.files); e.target.value = ''; }} />
      <span className="bf-drop-ic">⬆︎</span><b>גררו לכאן קבצים או לחצו לבחירה</b><small>אפשר כמה קבצים יחד · עד {INTAKE_MAX_MB}MB לקובץ</small></label>
    {(files.length > 0 || ups.length > 0) && <div className="bf-files">
      {files.map((f) => <div key={f.id} className="bf-file">{previews[f.id] ? <img src={previews[f.id]} alt="" /> : <span className="bf-file-ic">{icon(f.mime)}</span>}
        <div className="bf-file-t"><b title={f.name}>{f.name}</b><small>{fmtSize(f.size)} · הועלה ✓</small></div><button type="button" aria-label={`הסרת ${f.name}`} onClick={() => onRemove(f)}>✕</button></div>)}
      {ups.map((u) => <div key={u.tmp} className={`bf-file up ${u.error ? 'bad' : ''}`}>{previews[u.tmp] ? <img src={previews[u.tmp]} alt="" /> : <span className="bf-file-ic">⏳</span>}
        <div className="bf-file-t"><b title={u.name}>{u.name}</b>{u.error ? <small>{u.error}</small> : <><small>{fmtSize(u.size)} · מעלה {u.pct}%</small><i className="bf-bar"><i style={{ width: `${u.pct}%` }} /></i></>}</div>
        {u.error && <button type="button" aria-label="סגירה" onClick={() => onDismiss(u.tmp)}>✕</button>}</div>)}
    </div>}</div>;
}

function Review({ sections, data, files, pct, onJump, onSubmit, busy, submitted, err }: { sections: IntakeSection[]; data: Record<string, any>; files: IntakeFile[]; pct: number;
  onJump: (i: number) => void; onSubmit: () => void; busy: boolean; submitted: boolean; err: string }) {
  return <section className="bf-card">
    <div className="bf-sec-h"><span className="bf-sec-e">🚀</span><div><small>כמעט שם</small><h2>סיום ושליחה</h2><p>הנה מה שמילאתם. לא חייבים למלא הכול; כל פרט שתוסיפו יעזור לנו להגיע מוכנים יותר.</p></div></div>
    <ul className="bf-rev">{sections.map((s, i) => { const p = sectionProgress(s, data, files); return <li key={s.key}>
      <button onClick={() => onJump(i)}><span className="e">{p.done === p.total ? '✓' : s.emoji}</span><span className="t">{s.title}</span>
        <span className={`c ${p.done === p.total ? 'ok' : p.done ? 'part' : ''}`}>{p.done === p.total ? 'הושלם' : p.done ? `${p.done} מתוך ${p.total}` : 'עוד לא מולא'}</span></button></li>; })}</ul>
    <div className="bf-rev-sum"><b>{pct}%</b> מהתיק מולא · <b>{files.length}</b> קבצים הועלו</div>
    <button className="bf-btn big" disabled={busy} onClick={onSubmit}>{busy ? 'שולח…' : submitted ? 'שליחת העדכון לצוות' : 'שליחה לצוות פיקסל 🚀'}</button>
    <p className="bf-muted" style={{ textAlign: 'center' }}>גם אחרי השליחה אפשר לחזור, להוסיף ולעדכן.</p>
    {err && <p className="bf-err" role="alert">{err}</p>}
  </section>;
}
