'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { SERVICES } from '@/lib/services';
import { waLink } from '@/lib/wa';
import { fmtSize, intakeProgress, sectionProgress, sectionsFor, type IntakeFile } from '@/lib/intake';

type D = { intake: null | { token: string; client_name: string; services: string[]; data: Record<string, any>; files: IntakeFile[]; submitted_at: string | null; opened_at: string | null; updated_at: string; summary: string | null; summarized_at: string | null };
  contact: { name: string | null; phone: string | null } | null; snapshot: string | null };
const when = (d: string) => new Date(d).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const waText = (name: string, url: string) => `היי ${name}, כאן טל מפיקסל דיגיטל 👋\nשמחים מאוד שהצטרפת! 🎉\n\nלפני שיחת האפיון שלנו הכנו לך תיק אפיון אישי. שם אפשר לספר לנו על העסק ולהעלות לוגו, תמונות, סרטונים וכל חומר שיעזור לנו להכיר אתכם לעומק:\n${url}\n\nאפשר למלא בכמה פעמים, הכול נשמר אוטומטית. ככל שתשתפו יותר, השיחה שלנו תהיה ממוקדת ומדויקת יותר 🚀`;

/** Office side of the client intake file: create & send the link, follow progress, read answers, files and the AI prep sheet. */
export function IntakePanel({ clientId, d, full }: { clientId: string; d: D; full?: boolean }) {
  const r = useRouter(); const i = d.intake;
  const guess = useMemo(() => SERVICES.filter((s) => (d.snapshot ?? '').includes(s.label)).map((s) => s.key), [d.snapshot]);
  const [svc, setSvc] = useState<string[]>(i?.services?.length ? i.services : guess);
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const [copied, setCopied] = useState(false);
  const url = i ? `${typeof window !== 'undefined' ? location.origin : ''}/brief/${i.token}` : '';
  const pct = i ? intakeProgress(i.services, i.data, i.files) : 0;
  const first = (d.contact?.name ?? '').split(' ')[0] || '';
  const open = async () => { setBusy('open'); setMsg(''); const { error } = await supabaseBrowser().rpc('office_intake_open', { p_client: clientId, p_services: svc }); setBusy(''); if (error) setMsg(error.message); else { setMsg(i ? 'השירותים עודכנו ✓' : ''); r.refresh(); } };
  const wa = i ? waLink(d.contact?.phone, waText(first, url)) : null;
  const status = !i ? '' : i.submitted_at ? `✓ נשלח ${when(i.submitted_at)}` : i.opened_at ? `👀 נפתח ${when(i.opened_at)} · בתהליך מילוי` : 'עוד לא נפתח';
  const svcPick = <div className="ik-svc">{SERVICES.map((s) => <label key={s.key} className={svc.includes(s.key) ? 'on' : ''}><input type="checkbox" checked={svc.includes(s.key)} onChange={() => setSvc(svc.includes(s.key) ? svc.filter((x) => x !== s.key) : [...svc, s.key])} />{s.label}</label>)}</div>;

  if (!i) return <div className="card ik">
    <h2>📂 תיק אפיון ללקוח</h2>
    <p className="small muted">קישור אישי שבו הלקוח מספר על העסק ומעלה לוגו, תמונות, סרטונים וחומרים (עד 50MB לקובץ) לפני שיחת האפיון. השאלות מותאמות לשירותים שסימנת.</p>
    <b className="small">השירותים שנרכשו</b>{svcPick}
    <div className="row" style={{ marginTop: 10 }}><button className="btn y" disabled={!!busy} onClick={open}>{busy ? 'יוצר…' : 'יצירת תיק אפיון'}</button></div>
    {msg && <p className="small err">{msg}</p>}</div>;

  return <div className={`card ik ${full ? 'ik-full' : ''}`}>
    <div className="row"><h2 className="sp">📂 תיק אפיון</h2><b className="ik-pct">{pct}%</b></div>
    <div className="pt-onb-bar"><i style={{ width: `${pct}%` }} /></div>
    <p className="small" style={{ margin: '8px 0' }}>{status} · {i.files.length} קבצים</p>
    <div className="ik-act">
      {wa ? <a className="btn y" href={wa} target="_blank" rel="noreferrer">💬 שליחה בוואטסאפ</a> : <span className="btn" aria-disabled>אין טלפון לאיש קשר</span>}
      <button className="btn" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'הועתק ✓' : '🔗 העתקת קישור'}</button>
      <a className="btn ghost" href={url} target="_blank" rel="noreferrer">תצוגה כלקוח ↗</a>
      {!full && <Link className="btn ghost" href={`/clients/${clientId}?tab=intake`}>פתיחת התיק</Link>}
    </div>
    {full && <IntakeFull clientId={clientId} i={i} svcPick={svcPick} onSaveSvc={open} busy={busy} msg={msg} />}
  </div>;
}

function IntakeFull({ clientId, i, svcPick, onSaveSvc, busy, msg }: { clientId: string; i: NonNullable<D['intake']>; svcPick: React.ReactNode; onSaveSvc: () => void; busy: string; msg: string }) {
  const r = useRouter(); const [urls, setUrls] = useState<Record<string, string>>({}); const [sum, setSum] = useState(i.summary); const [sb, setSb] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { const paths = i.files.map((f) => f.path); if (!paths.length) return;
    supabaseBrowser().storage.from('client-intake').createSignedUrls(paths, 3600).then(({ data }) => setUrls(Object.fromEntries((data ?? []).filter((x) => x.signedUrl).map((x) => [x.path ?? "", x.signedUrl as string])))); }, [i.files]);
  const regen = async () => { setSb(true); setErr(''); const x = await fetch(`/api/clients/${clientId}/intake-summary`, { method: 'POST' }); const j = await x.json().catch(() => ({})); setSb(false); if (!x.ok) setErr(j.error ?? 'שגיאה'); else { setSum(j.summary); r.refresh(); } };
  const secs = sectionsFor(i.services);
  return <div className="ik-body">
    <section className="ik-sum"><div className="row"><h3 className="sp">🧠 דף הכנה לשיחה</h3><button className="btn sm" disabled={sb} onClick={regen}>{sb ? 'מכין…' : sum ? 'רענון הסיכום' : 'יצירת סיכום'}</button></div>
      {sum ? <div className="ik-md">{sum.split('\n').map((l, n) => /^##\s/.test(l) ? <h4 key={n}>{l.replace(/^##\s*/, '')}</h4> : l.trim() ? <p key={n}>{l.replace(/^[-*]\s*/, '• ')}</p> : null)}</div>
        : <p className="small muted">הסיכום נוצר אוטומטית כשהלקוח שולח את התיק. אפשר גם ליצור אותו עכשיו מהתשובות שכבר מולאו.</p>}
      {i.summarized_at && <p className="small muted">עודכן {when(i.summarized_at)}</p>}{err && <p className="small err">{err}</p>}</section>
    {secs.map((s) => { const d = i.data?.[s.key] ?? {}; const p = sectionProgress(s, i.data, i.files); if (!p.done) return null;
      return <section key={s.key} className="ik-sec"><h3>{s.emoji} {s.title} <small className="muted">{p.done}/{p.total}</small></h3>
        <dl>{s.qs.map((q) => { const fs = i.files.filter((f) => f.section === `${s.key}:${q.k}`); const v = d[q.k];
          if (q.type === 'files') return fs.length ? <div key={q.k}><dt>{q.label}</dt><dd className="ik-files">{fs.map((f) => { const u = urls[f.path];
            return <a key={f.id} href={u} target="_blank" rel="noreferrer" className="ik-file">{f.mime.startsWith('image/') && u ? <img src={u} alt="" /> : <span>{f.mime.startsWith('video/') ? '🎬' : '📄'}</span>}<b>{f.name}</b><small>{fmtSize(f.size)}</small></a>; })}</dd></div> : null;
          const txt = Array.isArray(v) ? v.filter(Boolean) : String(v ?? '').trim(); if (!txt.length) return null;
          return <div key={q.k}><dt>{q.label}</dt><dd>{Array.isArray(txt) ? (q.type === 'links' ? txt.map((x: string) => <a key={x} href={/^https?:/.test(x) ? x : `https://${x}`} target="_blank" rel="noreferrer" dir="ltr">{x}</a>) : txt.join(' · ')) : txt}</dd></div>; })}</dl></section>; })}
    <details className="ik-edit"><summary className="small"><b>שירותים בתיק (קובע אילו פרקים הלקוח רואה)</b></summary>{svcPick}
      <div className="row"><button className="btn sm" disabled={!!busy} onClick={onSaveSvc}>שמירת שירותים</button>{msg && <span className="small">{msg}</span>}</div></details>
  </div>;
}
