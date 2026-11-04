'use client';
import { useState } from 'react';
// Downloads the approved proposal as a real PDF file (rendered on the server from the print view).
export function PdfButton({ id, className = 'btn y' }: { id: string; className?: string }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/proposals/${id}/pdf`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? 'יצירת ה-PDF נכשלה'); }
      const blob = await res.blob(); const cd = res.headers.get('content-disposition') ?? '';
      const name = decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? 'proposal.pdf');
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) { setErr(e?.message ?? 'שגיאה'); } finally { setBusy(false); }
  };
  return <><button type="button" className={className} disabled={busy} onClick={go}>{busy ? 'מכין PDF…' : '⬇ הורדת PDF'}</button>{err && <span className="badge bad" role="status">{err}</span>}</>;
}
