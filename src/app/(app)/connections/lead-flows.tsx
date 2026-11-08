'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
// WhatsApp warm-up for form leads (Pixel / LOUD). Tal authorised (08.11.2026) that scripts he approves here
// replace his per-message approval — only in these warm-up chats. Any text change voids the approval and turns it off.
type Flow = { brand: 'pixel' | 'loud'; enabled: boolean; template_name: string; template_lang: string; opener: string; questions: string[]; closing: string; handoff: string; approved: boolean; approved_at: string | null; hash: string };
type Session = { id: string; brand: string; status: string; step: number; created_at: string; name: string; lead_id: string; answers: { q: string; a: string }[] };
const NAME: Record<string, string> = { pixel: 'פיקסל דיגיטל', loud: 'LOUD' };
const ST: Record<string, string> = { active: 'בשיחה', done: 'ענה על הכול', handoff: 'הועבר אליך', opted_out: 'ביקש להסיר', failed: 'לא נשלח' };
const ERR: Record<string, string> = { flow_not_approved: 'צריך לאשר את התסריט לפני הפעלה', flow_incomplete: 'חסר שם תבנית, פתיחה או לפחות שאלה אחת', snapshot_changed_reload: 'התסריט השתנה, רענן ונסה שוב', too_many_questions: 'עד 6 שאלות' };
const errText = (m: string) => Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? m;

function FlowCard({ f, hasSender }: { f: Flow; hasSender: boolean }) {
  const router = useRouter(); const sb = supabaseBrowser();
  const [d, setD] = useState({ template_name: f.template_name, opener: f.opener, questions: f.questions.join('\n'), closing: f.closing, handoff: f.handoff });
  const [busy, setBusy] = useState(''); const [err, setErr] = useState<string | null>(null);
  const dirty = d.template_name !== f.template_name || d.opener !== f.opener || d.questions !== f.questions.join('\n') || d.closing !== f.closing || d.handoff !== f.handoff;
  const run = async (k: string, fn: () => PromiseLike<{ error: any }>) => { setBusy(k); setErr(null); const { error } = await fn(); setBusy(''); if (error) setErr(errText(error.message)); else router.refresh(); };
  const save = () => run('save', () => sb.rpc('office_lead_flow_save', { p_brand: f.brand, p: { ...d, questions: d.questions.split('\n') } }));
  const approve = () => { if (!window.confirm(`לאשר את התסריט של ${NAME[f.brand]}?\nמרגע ההפעלה, ההודעות האלה יישלחו אוטומטית לכל ליד חדש מהטופס, בלי אישור נפרד לכל הודעה.`)) return;
    run('approve', () => sb.rpc('office_lead_flow_approve', { p_brand: f.brand, p_hash: f.hash })); };
  const toggle = () => run('toggle', () => sb.rpc('office_lead_flow_toggle', { p_brand: f.brand, p_enabled: !f.enabled }));
  const field = (k: keyof typeof d, label: string, rows = 2, hint?: string) => <label className="lf-f"><span>{label}{hint && <small className="muted"> · {hint}</small>}</span>
    <textarea rows={rows} value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} /></label>;
  return <div className="lf-card">
    <div className="row"><b className="sp">{NAME[f.brand]}</b>
      {f.enabled ? <span className="badge ok">פעיל</span> : f.approved ? <span className="badge">מאושר · כבוי</span> : <span className="badge warn">ממתין לאישורך</span>}</div>
    <label className="lf-f"><span>שם התבנית ב-Meta <small className="muted">· ההודעה הראשונה חייבת להיות תבנית מאושרת</small></span>
      <input dir="ltr" value={d.template_name} onChange={(e) => setD({ ...d, template_name: e.target.value })} /></label>
    {field('opener', 'הודעת פתיחה (התבנית)', 3, '{{1}} = שם פרטי. הנוסח צריך להיות זהה לתבנית ב-Meta')}
    {field('questions', 'שאלות, שאלה בכל שורה', 5, 'נשלחות אחת אחרי השנייה, אחרי כל תשובה')}
    {field('closing', 'הודעת סיום', 2)}
    {field('handoff', 'כשהליד שואל שאלה או מבקש לדבר עם מישהו', 2, 'הבוט עוצר ומעביר אליך')}
    <div className="lf-actions">
      {dirty ? <button className="btn y" disabled={!!busy} onClick={save}>{busy === 'save' ? 'שומר…' : 'שמירה'}</button>
      : <>{!f.approved && <button className="btn y" disabled={!!busy} onClick={approve}>{busy === 'approve' ? 'מאשר…' : '✓ אני מאשר את התסריט'}</button>}
          {f.approved && <button className={`btn ${f.enabled ? '' : 'y'}`} disabled={!!busy} onClick={toggle}>{busy === 'toggle' ? '…' : f.enabled ? 'כיבוי' : 'הפעלה'}</button>}</>}
    </div>
    {dirty && f.approved && <p className="small muted">שמירת שינוי מבטלת את האישור ומכבה את התהליך עד שתאשר מחדש.</p>}
    {f.enabled && !hasSender && <p className="small" style={{ color: 'var(--bad)' }}>מופעל, אבל אין חשבון WhatsApp Business מחובר, אז לא תישלח שום הודעה עד שיחובר.</p>}
    {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
  </div>;
}

export function LeadFlows({ data }: { data: { flows: Flow[]; sender: { provider: string; label: string } | null; sessions: Session[] } | null }) {
  if (!data) return null;
  const real = data.sender?.provider === 'whatsapp_cloud';
  return <div className="card" style={{ marginBottom: 12 }}>
    <div className="row"><h2 className="sp">חימום לידים בוואטסאפ</h2>
      {real ? <span className="badge ok">{data.sender!.label}</span> : data.sender ? <span className="badge warn">סביבת בדיקה בלבד</span> : <span className="badge">WhatsApp Business לא מחובר</span>}</div>
    <p className="small muted">כל ליד חדש מהטופס (פיקסל או LOUD) מקבל הודעת פתיחה, ואחריה השאלות אחת אחרי השנייה. התשובות נשמרות בכרטיס הליד, ובסוף מגיע אליך מייל. אם הליד שואל שאלה, מבקש לדבר עם מישהו או שואל על מחיר, הבוט עוצר ומעביר אליך. מי שכותב &quot;הסר&quot; לא יקבל יותר הודעות. נשלחים רק נוסחים שאישרת כאן.</p>
    <div className="lf-grid">{data.flows.map((f) => <FlowCard key={f.brand + f.hash} f={f} hasSender={!!data.sender} />)}</div>
    {data.sessions.length > 0 && <><h3 style={{ margin: '16px 0 8px' }}>שיחות אחרונות</h3>
      <div className="lf-sessions">{data.sessions.map((s) => <a key={s.id} href={`/leads/${s.lead_id}`} className="lf-s">
        <b>{s.name}</b><span className="muted">{NAME[s.brand]}</span><span className={`badge ${s.status === 'done' ? 'ok' : s.status === 'handoff' ? 'warn' : ''}`}>{ST[s.status] ?? s.status}</span>
        <span className="muted small">{s.answers.length} תשובות</span></a>)}</div></>}
  </div>;
}
