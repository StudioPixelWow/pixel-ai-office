'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';
import { SERVICES, SERVICE_BY_KEY, VAT_MODE_HE } from '@/lib/services';

type P = { id?: string; name: string; kind: 'retainer' | 'one_time'; services: string[]; price: number | string | null; vat_mode: string; description?: string | null; addon_title?: string | null; addon_price?: number | string | null };
const blank: P = { name: '', kind: 'retainer', services: [], price: '', vat_mode: 'plus_vat', description: '', addon_title: '', addon_price: '' };

function Editor({ p, onDone }: { p: P; onDone: () => void }) {
  const r = useRouter(); const [v, setV] = useState<P>({ ...p, price: p.price ?? '', addon_price: p.addon_price ?? '' }); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async () => { setBusy(true); setErr(''); try { await callAction('package_save', { ...v, services: v.services }); r.refresh(); onDone(); } catch (e) { setErr(heError(e)); } finally { setBusy(false); } };
  const del = async () => { if (!v.id || !window.confirm('להסיר את החבילה?')) return; setBusy(true); try { await callAction('package_archive', { id: v.id }); r.refresh(); onDone(); } catch (e) { setErr(heError(e)); } finally { setBusy(false); } };
  return <div className="f pk-ed">
    <div className="grid g2"><label>שם החבילה *<input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
      <label>סוג<select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as any })}><option value="retainer">ריטיינר חודשי</option><option value="one_time">פרויקט חד-פעמי</option></select></label></div>
    <fieldset className="chips"><legend className="small muted">שירותים</legend>{SERVICES.filter((s) => s.kind === v.kind || v.services.includes(s.key)).map((s) =>
      <label key={s.key} className={`chip ${v.services.includes(s.key) ? 'on' : ''}`}><input type="checkbox" checked={v.services.includes(s.key)} onChange={() => setV({ ...v, services: v.services.includes(s.key) ? v.services.filter((x) => x !== s.key) : [...v.services, s.key] })} />{s.label}</label>)}</fieldset>
    <div className="grid g2"><label>מע״מ<select value={v.vat_mode} onChange={(e) => setV({ ...v, vat_mode: e.target.value })}>{Object.entries(VAT_MODE_HE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label></div>
    <label>תיאור קצר<input value={v.description ?? ''} onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
    <div className="grid g2"><label>תוספת אופציונלית<input value={v.addon_title ?? ''} onChange={(e) => setV({ ...v, addon_title: e.target.value })} placeholder="למשל: יום צילום רבעוני" /></label>
      <span /></div>
    <div className="row"><button className="btn y sm" disabled={busy || !v.name.trim() || !v.services.length} onClick={save}>{busy ? '…' : 'שמירה'}</button>{v.id && <button className="btn sm ghost" disabled={busy} onClick={del}>הסרה</button>}<button className="btn sm ghost" onClick={onDone}>ביטול</button>{err && <span className="small" style={{ color: 'var(--bad)' }}>{err}</span>}</div>
  </div>;
}

export function Packages({ items, canEdit }: { items: P[]; canEdit: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  return <div className="card"><h2>חבילות שירות</h2>
    <p className="small muted">חבילה ממלאת רק את השירותים בהצעת מחיר חדשה. המחיר נקבע ידנית בכל הצעה בנפרד.</p>
    <div className="pk-list">{items.map((p) => <div key={p.id} className="pk-item">
      {open === p.id ? <Editor p={p} onDone={() => setOpen(null)} /> : <div className="pk-row"><div><b>{p.name}</b><small>{p.kind === 'retainer' ? 'ריטיינר' : 'חד-פעמי'} · {p.services.map((k) => SERVICE_BY_KEY[k]?.label ?? k).join(' · ')}</small></div>
        <span className="pk-price">מחיר בכל הצעה</span>{canEdit && <button className="btn sm ghost" onClick={() => setOpen(p.id!)}>עריכה</button>}</div>}
    </div>)}</div>
    {canEdit && (open === 'new' ? <Editor p={blank} onDone={() => setOpen(null)} /> : <button className="btn sm" onClick={() => setOpen('new')}>＋ חבילה חדשה</button>)}
  </div>;
}
