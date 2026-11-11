'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { heError } from '@/lib/errors';

/** Owner: change only the price of an issued, unsigned proposal. Same content, new approved version; the client's link shows it at once. */
export function RepriceBox({ proposalId, setup, monthly, media }: { proposalId: string; setup: number | null; monthly: number | null; media: number | null }) {
  const r = useRouter(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const num = (v: FormDataEntryValue | null) => { const s = String(v ?? '').replace(/[,\s₪]/g, ''); return s === '' ? null : Number(s); };
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setMsg(null);
    const { data, error } = await supabaseBrowser().rpc('office_proposal_reprice', { p_proposal: proposalId, p_setup: num(f.get('setup')), p_monthly: num(f.get('monthly')), p_media: num(f.get('media')), p_reason: String(f.get('reason') ?? '') });
    setBusy(false);
    if (error) return setMsg({ ok: false, t: error.message.includes('already_signed') ? 'ההצעה כבר נחתמה או נסגרה — אי אפשר לשנות בה מחיר.' : error.message.includes('price_required') ? 'צריך למלא לפחות דמי הקמה או ריטיינר חודשי.' : heError(error) });
    setMsg({ ok: true, t: `המחיר עודכן (גרסה ${(data as any)?.version_no}). ${(data as any)?.has_link ? 'הקישור שכבר שלחת מציג עכשיו את המחיר החדש — אפשר לשלוח אותו שוב, או ליצור קישור חדש.' : 'עכשיו צור קישור ושלח לחתימה.'}` });
    r.refresh();
  }
  return <details className="reprice"><summary>✏️ עדכון מחיר בהצעה</summary>
    <form className="f" onSubmit={save}>
      <div className="reprice-g">
        <label>דמי הקמה (₪)<input name="setup" inputMode="decimal" defaultValue={setup ?? ''} dir="ltr" /></label>
        <label>ריטיינר חודשי (₪)<input name="monthly" inputMode="decimal" defaultValue={monthly ?? ''} dir="ltr" /></label>
        <label>תקציב מדיה נפרד (₪)<input name="media" inputMode="decimal" defaultValue={media ?? ''} dir="ltr" /></label>
      </div>
      <label>סיבה (לא חובה)<input name="reason" placeholder="למשל: הנחה אחרי שיחה" /></label>
      <p className="small muted">התוכן נשאר בדיוק אותו דבר. רק המחיר מתעדכן, ונשמרת היסטוריה של המחיר הקודם.</p>
      <div className="row"><button className="btn y" disabled={busy}>{busy ? 'מעדכן…' : 'עדכן מחיר'}</button></div>
      {msg && <span className={`small${msg.ok ? '' : ' err'}`} role="status">{msg.t}</span>}
    </form></details>;
}
