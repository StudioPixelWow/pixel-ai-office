'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';

/** Run / re-run full client research, and the manual ChatGPT path (prepared prompt → paste the answer back). */
export function ResearchPanel({ clientId, name, industry, website, socials }: { clientId: string; name: string; industry?: string | null; website?: string | null; socials?: Record<string, string> }) {
  const r = useRouter(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [paste, setPaste] = useState('');
  const prompt = `בצע מחקר שיווקי מקיף (Deep Research) על העסק "${name}"${industry ? ` בתחום ${industry}` : ''}${website ? `, אתר: ${website}` : ''}${socials && Object.keys(socials).length ? `, רשתות: ${Object.values(socials).join(', ')}` : ''}.
כלול עם קישור מקור לכל פרט: תיאור העסק והשירותים, קהלי יעד, טון ושפה ברשתות (נתח 10–20 פוסטים/רילסים אחרונים: סגנון, אורך, הוקים, האשטגים, מה מקבל הכי הרבה מעורבות), ביקורות ומוניטין, 3–6 מתחרים בישראל, פערים והזדמנויות, 30 רעיונות לתוכן בשפת העסק, ביטויי SEO ושאלות שאנשים שואלים מנועי AI. הפרד עובדות מהערכות. כתוב בעברית.`;
  async function run(f: FormData) {
    setBusy(true); setMsg('');
    const socials: Record<string, string> = {};
    for (const k of ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin']) { const v = String(f.get(k) ?? '').trim(); if (v) socials[k] = v; }
    try { const d = await callAction('start_client_research', { client_id: clientId, website: f.get('website'), socials, notes: f.get('notes') }); setMsg(d.note); r.push(`/room/${d.request_id}`); }
    catch (e) { setMsg(heError(e)); } finally { setBusy(false); }
  }
  async function save() {
    if (paste.trim().length < 50) { setMsg('הדבק את תשובת ChatGPT המלאה'); return; }
    setBusy(true); try { await callAction('add_knowledge', { client_id: clientId, scope: 'client', kind: 'source', title: `[מחקר ChatGPT ידני] ${name}`, body: paste }); setPaste(''); setMsg('נשמר לספריית הידע'); r.refresh(); }
    catch (e) { setMsg(heError(e)); } finally { setBusy(false); }
  }
  return <div className="f">
    <form className="f" onSubmit={(e) => { e.preventDefault(); run(new FormData(e.currentTarget)); }}>
      <div className="grid g2"><label>אתר<input name="website" dir="ltr" defaultValue={website ?? ''} /></label><label>אינסטגרם<input name="instagram" dir="ltr" defaultValue={socials?.instagram ?? ''} /></label>
        <label>פייסבוק<input name="facebook" dir="ltr" defaultValue={socials?.facebook ?? ''} /></label><label>טיקטוק<input name="tiktok" dir="ltr" defaultValue={socials?.tiktok ?? ''} /></label>
        <label>יוטיוב<input name="youtube" dir="ltr" defaultValue={socials?.youtube ?? ''} /></label><label>לינקדאין<input name="linkedin" dir="ltr" defaultValue={socials?.linkedin ?? ''} /></label></div>
      <label>דגשים למחקר<input name="notes" placeholder="למשל: להתמקד בקהל צעיר, מתחרים באזור הצפון" /></label>
      <div className="row"><button className="btn y" disabled={busy}>{busy ? 'מפעיל…' : 'הפעל מחקר לקוח מלא'}</button><span className="small muted">אתר · רשתות ודוגמאות תוכן · מוניטין ומתחרים · ChatGPT · תיק לקוח (כ-1–3$)</span></div>
    </form>
    <details><summary className="small"><b>מחקר ידני ב-ChatGPT שלך</b> (Deep Research בחשבון שלך)</summary><div className="f" style={{ marginTop: 8 }}>
      <pre className="out" style={{ whiteSpace: 'pre-wrap' }}>{prompt}</pre>
      <div className="row"><button type="button" className="btn sm" onClick={() => navigator.clipboard.writeText(prompt).then(() => setMsg('הפרומפט הועתק'))}>העתק פרומפט</button>
        <a className="btn sm" href={`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`} target="_blank" rel="noreferrer">פתח ב-ChatGPT</a></div>
      <label>הדבק כאן את התשובה<textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} /></label>
      <button type="button" className="btn" disabled={busy} onClick={save}>שמור לספריית הידע</button></div></details>
    {msg && <span className="small" role="status">{msg}</span>}
  </div>;
}
