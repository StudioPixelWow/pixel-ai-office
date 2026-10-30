'use client';
import { useState } from 'react';
const STEPS = ['קצת עליך', 'הפודקאסט שלך', '3 נקודות מפתח'];
export function IntakeForm() {
  const [step, setStep] = useState(0); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState<string | null>(null);
  const [f, setF] = useState<any>({ name: '', business: '', role: '', phone: '', email: '', website: '', socials: '', what_matters: '', done_before: 'no', done_before_details: '', key_points: ['', '', ''], preferred_times: '', company_site: '' });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const kp = (i: number) => (e: any) => { const a = [...f.key_points]; a[i] = e.target.value; setF({ ...f, key_points: a }); };
  const valid = [() => f.name.trim() && /\d{9,}/.test(f.phone.replace(/\D/g, '')), () => f.what_matters.trim().length > 3, () => f.key_points.some((x: string) => x.trim())];
  async function submit() {
    setBusy(true); setErr('');
    const r = await fetch('/api/public/podcast/intake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return setErr(j.error ?? 'משהו השתבש'); setDone(j.url ?? '');
  }
  if (done !== null) return <div className="ld-done"><div className="ld-done-ico">🎙️</div><h2>קיבלנו! מתחילים לעבוד</h2>
    <p>הצוות שלנו כבר חוקר ומכין בשבילך קובץ שאלות אישי לראיון. ברגע שהוא מוכן נשלח לך אותו לעיון ואישור.</p>
    {done && <a className="ld-btn" href={done}>לעמוד האישי שלי ←</a>}</div>;
  return <div>
    <div className="ld-steps">{STEPS.map((s, i) => <button key={s} type="button" className={i === step ? 'on' : i < step ? 'ok' : ''} onClick={() => i < step && setStep(i)}><b>{i < step ? '✓' : i + 1}</b>{s}</button>)}</div>
    <form onSubmit={(e) => { e.preventDefault(); if (step < 2) { if (valid[step]()) setStep(step + 1); } else submit(); }} className="ld-f">
      <input className="ld-hp" tabIndex={-1} autoComplete="off" value={f.company_site} onChange={set('company_site')} aria-hidden />
      {step === 0 && <>
        <div className="ld-2"><label>שם מלא *<input value={f.name} onChange={set('name')} required autoComplete="name" /></label>
          <label>שם העסק<input value={f.business} onChange={set('business')} autoComplete="organization" /></label></div>
        <div className="ld-2"><label>טלפון נייד *<input value={f.phone} onChange={set('phone')} required inputMode="tel" dir="ltr" placeholder="050-0000000" autoComplete="tel" /></label>
          <label>מייל<input value={f.email} onChange={set('email')} type="email" dir="ltr" autoComplete="email" /></label></div>
        <label>אתר<input value={f.website} onChange={set('website')} dir="ltr" placeholder="www.example.co.il" /></label>
        <label>רשתות חברתיות<span>הדביקו קישורים לפייסבוק / אינסטגרם / טיקטוק / לינקדאין</span><textarea value={f.socials} onChange={set('socials')} dir="ltr" rows={2} /></label>
      </>}
      {step === 1 && <>
        <label>מה הכי חשוב לך בפודקאסט? *<span>מה תרצו שהמאזינים ירגישו, יבינו או יעשו בסוף הפרק</span><textarea value={f.what_matters} onChange={set('what_matters')} rows={4} required /></label>
        <fieldset className="ld-choice"><legend>הקלטת/ה פודקאסט בעבר?</legend>
          {[['no', 'זו הפעם הראשונה'], ['yes', 'כן, כבר עשיתי']].map(([v, l]) => <label key={v} className={f.done_before === v ? 'on' : ''}><input type="radio" name="db" checked={f.done_before === v} onChange={() => setF({ ...f, done_before: v })} />{l}</label>)}</fieldset>
        {f.done_before === 'yes' && <label>איפה? מה עבד ומה פחות?<textarea value={f.done_before_details} onChange={set('done_before_details')} rows={2} /></label>}
        <label>מועדים שנוחים לך<span>לדוגמה: בקרים, ימי ג׳-ה׳</span><input value={f.preferred_times} onChange={set('preferred_times')} /></label>
      </>}
      {step === 2 && <>
        <p className="ld-hint">אילו 3 דברים חייבים לעלות בראיון? (סיפור, מסר, הישג, טעות שלמדתם ממנה…)</p>
        {[0, 1, 2].map((i) => <label key={i} className="ld-kp"><b>{i + 1}</b><textarea value={f.key_points[i]} onChange={kp(i)} rows={2} placeholder={['למשל: איך הכל התחיל', 'למשל: מה מבדל אותנו', 'למשל: טיפ שכל בעל עסק צריך'][i]} /></label>)}
      </>}
      {err && <div className="ld-err" role="alert">{err}</div>}
      <div className="ld-nav">{step > 0 && <button type="button" className="ld-btn ghost" onClick={() => setStep(step - 1)}>→ חזרה</button>}
        <button className="ld-btn" disabled={busy || !valid[step]()}>{step < 2 ? 'המשך ←' : busy ? 'שולח…' : 'שליחה 🎙️'}</button></div>
    </form>
  </div>;
}
