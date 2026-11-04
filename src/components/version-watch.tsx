'use client';
import { useEffect, useState } from 'react';
// A tab left open keeps running the old code after a deploy (client-side navigation never reloads it).
// Check the live build on focus and every 3 minutes; when it changed, reload on the next navigation or offer a refresh.
const v = process.env.NEXT_PUBLIC_BUILD ?? 'dev'; // baked into this bundle at build time
export function VersionWatch() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let dead = false;
    const check = async () => { try { const j = await fetch('/api/version', { cache: 'no-store' }).then((r) => r.json()); if (!dead && j?.v && j.v !== v) setStale(true); } catch { /* offline */ } };
    const t = setInterval(check, 180000); const f = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', f); window.addEventListener('focus', f); check();
    return () => { dead = true; clearInterval(t); document.removeEventListener('visibilitychange', f); window.removeEventListener('focus', f); };
  }, []);
  useEffect(() => { // first link click after a deploy does a full page load, so the new code arrives without asking
    if (!stale) return;
    const h = (e: MouseEvent) => { const a = (e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null; if (a && a.origin === location.origin && !a.target && !e.metaKey && !e.ctrlKey) { e.preventDefault(); location.href = a.href; } };
    document.addEventListener('click', h, true); return () => document.removeEventListener('click', h, true);
  }, [stale]);
  if (!stale) return null;
  return <div className="ver-bar" role="status"><span>עלתה גרסה חדשה של המערכת</span><button className="btn y sm" onClick={() => location.reload()}>רענון</button></div>;
}
