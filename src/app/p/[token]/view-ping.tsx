'use client';
import { useEffect } from 'react';
// Tells the office the proposal is being read: one ping on open, then every 20s while the tab is visible.
export function ViewPing({ token }: { token: string }) {
  useEffect(() => {
    let view: string | null = null; let stop = false;
    const ping = () => fetch(`/api/public/proposals/${token}/view`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ view }) })
      .then((r) => r.json()).then((j) => { if (j?.view) view = j.view; }).catch(() => null);
    ping(); const i = setInterval(() => { if (!stop && document.visibilityState === 'visible') ping(); }, 20000);
    return () => { stop = true; clearInterval(i); };
  }, [token]);
  return null;
}
