'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
// The ready WhatsApp text Tal sends manually to every new form lead (in the email button and on the lead page).
export function WaTexts({ texts }: { texts: Record<string, string> | null }) {
  const [t, setT] = useState<Record<string, string>>({ pixel: texts?.pixel ?? '', loud: texts?.loud ?? '' });
  const [saved, setSaved] = useState(''); const [err, setErr] = useState<string | null>(null);
  if (!texts) return null;
  const save = async (b: string) => { setErr(null); const { error } = await supabaseBrowser().rpc('office_lead_wa_text_save', { p_brand: b, p_text: t[b] });
    if (error) setErr(error.message); else { setSaved(b); setTimeout(() => setSaved(''), 1500); } };
  return <div className="card" style={{ marginBottom: 12 }}>
    <h2>הודעת וואטסאפ לליד חדש</h2>
    <p className="small muted">על כל ליד חדש מהטופס מגיע אליך מייל עם כפתור &quot;פתיחת שיחה בוואטסאפ&quot;. הכפתור פותח את הוואטסאפ בטלפון עם ההודעה הזו מוכנה, ואתה לוחץ שליחה. אותו כפתור יש גם בכרטיס הליד. {'{{1}}'} = השם הפרטי של הליד.</p>
    <div className="lf-grid">{(['pixel', 'loud'] as const).map((b) => <div key={b} className="lf-card">
      <b>{b === 'pixel' ? 'פיקסל דיגיטל' : 'LOUD'}</b>
      <textarea className="wa-bubble" rows={9} value={t[b]} onChange={(e) => setT({ ...t, [b]: e.target.value })} />
      <div className="lf-actions"><button className="btn y" onClick={() => save(b)}>{saved === b ? '✓ נשמר' : 'שמירה'}</button></div>
    </div>)}</div>
    {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
  </div>;
}
