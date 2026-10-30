'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { heError } from '@/lib/errors';

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up' | 'magic'>('in'); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const email = String(fd.get('email')); const password = String(fd.get('password') ?? '');
    const sb = supabaseBrowser(); setBusy(true); setMsg('');
    try {
      const redirect = `${location.origin}/auth/callback`;
      if (mode === 'magic') { const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: true } }); if (error) throw error; setMsg('נשלח קישור כניסה למייל.'); }
      else if (mode === 'up') { const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect } }); if (error) throw error;
        if (data.session) location.href = '/'; else setMsg('נשלח מייל אימות. אחרי האימות אפשר להיכנס.'); }
      else { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; location.href = '/'; }
    } catch (err) { setMsg(heError(err)); } finally { setBusy(false); }
  }
  const e = typeof window !== 'undefined' ? new URLSearchParams(location.search).get('e') : null;
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--grad)', padding: 16 }}>
    <div className="card" style={{ width: 'min(440px,100%)', padding: 30 }}>
      <img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-500.webp" alt="Pixel Digital" style={{ height: 40 }} />
      <h1 style={{ marginTop: 14 }}>PIXEL <span className="mark">AI OFFICE</span></h1>
      <p className="muted">מערכת פנימית. הכניסה למשתמשים מורשים בלבד.</p>
      {e && <div className="note bad">{heError(e)}</div>}
      <form className="f" onSubmit={go} style={{ marginTop: 12 }}>
        <label>אימייל<input name="email" type="email" required dir="ltr" autoComplete="email" /></label>
        {mode !== 'magic' && <label>סיסמה<input name="password" type="password" required minLength={10} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} dir="ltr" /></label>}
        <button className="btn y" disabled={busy}>{mode === 'in' ? 'כניסה' : mode === 'up' ? 'יצירת חשבון' : 'שלח קישור כניסה'}</button>
      </form>
      <div className="row small" style={{ marginTop: 12 }}>
        <button className="btn ghost sm" onClick={() => setMode('in')}>כניסה</button>
        <button className="btn ghost sm" onClick={() => setMode('up')}>הרשמה ראשונה (Owner)</button>
        <button className="btn ghost sm" onClick={() => setMode('magic')}>קישור למייל</button>
      </div>
      {msg && <p className="small" role="status">{msg}</p>}
    </div></div>;
}
