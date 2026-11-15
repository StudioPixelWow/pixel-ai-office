'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { heError } from '@/lib/errors';

const resetTo = () => `${location.origin}/auth/callback?next=${encodeURIComponent('/settings#password')}`;

/** Owner: send a team member a reset link by email. The member sets the new password; nobody else sees it. */
export function SendReset({ email }: { email: string }) {
  const [s, setS] = useState<'idle' | 'busy' | 'ok' | string>('idle');
  async function send() {
    if (!confirm(`לשלוח קישור לאיפוס סיסמה אל ${email}?`)) return;
    setS('busy'); const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, { redirectTo: resetTo() });
    setS(error ? heError(error) : 'ok');
  }
  return s === 'ok' ? <span className="small">✓ נשלח</span> : <span className="row" style={{ gap: 6 }}>
    <button className="btn ghost sm" disabled={s === 'busy'} onClick={send}>איפוס סיסמה</button>{!['idle', 'busy'].includes(s) && <span className="small err">{s}</span>}</span>;
}

/** Any signed-in user: set a new password (also the landing spot of a reset link). */
export function ChangePassword() {
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const a = String(f.get('p1') ?? ''); const b = String(f.get('p2') ?? '');
    if (a.length < 10) return setMsg({ ok: false, t: 'הסיסמה צריכה להיות לפחות 10 תווים.' });
    if (a !== b) return setMsg({ ok: false, t: 'שתי הסיסמאות לא זהות.' });
    setBusy(true); const { error } = await supabaseBrowser().auth.updateUser({ password: a }); setBusy(false);
    if (error) return setMsg({ ok: false, t: heError(error) });
    e.currentTarget.reset(); setMsg({ ok: true, t: 'הסיסמה עודכנה. בכניסה הבאה משתמשים בסיסמה החדשה.' });
  }
  return <div className="card" id="password" style={{ scrollMarginTop: 90 }}><h2>שינוי סיסמה</h2>
    <form className="f" onSubmit={save}>
      <label>סיסמה חדשה<input name="p1" type="password" autoComplete="new-password" minLength={10} required dir="ltr" /></label>
      <label>שוב, לאימות<input name="p2" type="password" autoComplete="new-password" minLength={10} required dir="ltr" /></label>
      <div className="row"><button className="btn y" disabled={busy}>{busy ? 'שומר…' : 'עדכון סיסמה'}</button></div>
      {msg && <span className={`small${msg.ok ? '' : ' err'}`} role="status">{msg.t}</span>}
    </form></div>;
}
