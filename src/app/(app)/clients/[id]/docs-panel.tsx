'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';

const KIND: Record<string, string> = { contract: 'חוזה', agreement: 'הסכם', nda: 'NDA / סודיות', brief: 'בריף', report: 'דוח', invoice: 'חשבונית', other: 'אחר' };
const ST: Record<string, [string, string]> = { draft: ['טיוטה — לא בפורטל', 'muted'], shared: ['בפורטל', 'c'], signed: ['נחתם ✓', 'ok'], void: ['בוטל', 'muted'] };
const fmt = (d: string) => new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

export function DocsPanel({ clientId, docs }: { clientId: string; docs: any[] }) {
  const r = useRouter(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [f, setF] = useState<{ title: string; kind: string; sign: boolean; file: File | null; url: string }>({ title: '', kind: 'contract', sign: true, file: null, url: '' });
  const upload = async () => {
    setBusy(true); setMsg(null);
    try {
      let b64: string | null = null; let mime: string | null = null;
      if (f.file) { if (f.file.size > 3_000_000) throw new Error('קובץ גדול מדי (עד 3MB)'); mime = f.file.type; b64 = await new Promise<string>((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.onerror = no; fr.readAsDataURL(f.file!); }); }
      const res = await fetch(`/api/clients/${clientId}/documents`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: f.title, kind: f.kind, sign: f.sign, b64, mime, url: f.url || null }) }).then((x) => x.json());
      if (res.error) throw new Error(res.error);
      setMsg({ ok: true, t: 'המסמך נוסף. לחץ "שיתוף בפורטל" כדי שהלקוח יראה אותו.' }); setF({ title: '', kind: 'contract', sign: true, file: null, url: '' }); r.refresh();
    } catch (e) { setMsg({ ok: false, t: heError(e) }); } finally { setBusy(false); }
  };
  const run = async (action: string, id: string, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return; setBusy(true); setMsg(null);
    try { const d = await callAction(action, { id }); setMsg({ ok: true, t: d?.note ?? 'בוצע' }); r.refresh(); } catch (e) { setMsg({ ok: false, t: heError(e) }); } finally { setBusy(false); }
  };
  return <div className="grid g2">
    <div className="card"><h2>מסמכים וחוזים</h2>
      {docs.length ? <ul className="dc-list">{docs.map((d) => { const s = ST[d.status] ?? [d.status, 'muted'];
        return <li key={d.id} className={d.status}>
          <div className="dc-h"><b>{d.title}</b><span className={`badge ${s[1]}`}>{s[0]}</span></div>
          <small className="muted">{KIND[d.kind] ?? d.kind}{d.requires_signature ? ' · דורש חתימה' : ''} · נוסף {fmt(d.created_at)}</small>
          {d.status === 'signed' && <div className="dc-sig">{d.signature_blob_id && <img src={`/api/files/${d.signature_blob_id}`} alt="חתימה" />}<small>נחתם ע״י <b>{d.signer_name}</b> · {fmt(d.signed_at)}{d.sign_ip ? ` · IP ${d.sign_ip}` : ''}</small></div>}
          <div className="dc-act">
            {(d.blob_id || d.external_url) && <a className="btn sm ghost" href={d.blob_id ? `/api/files/${d.blob_id}` : d.external_url} target="_blank" rel="noreferrer">פתיחה</a>}
            {['draft', 'shared'].includes(d.status) && <button className="btn sm y" disabled={busy} onClick={() => run('doc_share', d.id)}>{d.status === 'draft' ? 'שיתוף בפורטל' : 'שליחה שוב'}</button>}
            {d.status !== 'void' && d.status !== 'signed' && <button className="btn sm ghost" disabled={busy} onClick={() => run('doc_void', d.id, 'לבטל את המסמך? הוא ייעלם מהפורטל.')}>ביטול</button>}
            <button className="btn sm ghost" disabled={busy} onClick={() => run('doc_archive', d.id, 'להסיר את המסמך מהרשימה?')}>הסרה</button>
          </div></li>; })}</ul> : <p className="muted">עוד אין מסמכים. העלה חוזה, הסכם או בריף — והלקוח יוכל לעיין ולחתום דיגיטלית בפורטל.</p>}
      {msg && <p className="small" style={{ color: msg.ok ? 'var(--ok)' : 'var(--bad)' }}>{msg.t}</p>}
    </div>
    <div className="card"><h2>מסמך חדש</h2><div className="f">
      <label>כותרת *<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="למשל: הסכם ריטיינר 2027" /></label>
      <label>סוג<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label>קובץ (PDF או תמונה, עד 3MB)<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setF({ ...f, file: e.target.files?.[0] ?? null })} /></label>
      {!f.file && <label>או קישור (https)<input dir="ltr" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://…" /></label>}
      <label className="chk"><input type="checkbox" checked={f.sign} onChange={(e) => setF({ ...f, sign: e.target.checked })} /> הלקוח צריך לחתום דיגיטלית</label>
      <button className="btn y" disabled={busy || !f.title.trim() || (!f.file && !/^https:\/\//.test(f.url))} onClick={upload}>{busy ? 'מעלה…' : 'הוספת מסמך'}</button>
    </div></div>
  </div>;
}
