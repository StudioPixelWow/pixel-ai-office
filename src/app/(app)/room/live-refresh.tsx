'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Re-fetches server data while a meeting is live (pauses when the tab is hidden).
export function LiveRefresh({ ms = 5000 }: { ms?: number }) {
  const r = useRouter();
  useEffect(() => { const i = setInterval(() => { if (document.visibilityState === 'visible') r.refresh(); }, ms); return () => clearInterval(i); }, [r, ms]);
  return null;
}
