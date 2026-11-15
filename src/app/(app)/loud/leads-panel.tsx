'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { waLink } from '@/lib/wa';
// LOUD form leads and the journey of each: in → WhatsApp → in talks → booking → recorded.
type L = { id: string; created_at: string; stage: string; version: number; contact_name: string | null; first_name_he: string | null; company: string | null; phone: string | null; need: string | null;
  wa_opened_at: string | null; wa_text: string; studio_date: string | null; booked_text: string | null; booking_id: string | null; booking_status: string | null; starts_at: string | null; recorded_at: string | null };
const STEPS = ['נכנס', 'וואטסאפ', 'בירור צרכים', 'מועד נקבע', 'הוקלט'];
const fmt = (d: string) => new Date(d).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
// datetime-local value in Israel time
const local = (d: string | null) => { if (!d) return ''; const x = new Date(new Date(d).toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })); const z = (n: number) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())}T${z(x.getHours())}:${z(x.getMinutes())}`; };
// Israel wall-clock → ISO with the right offset (handles DST)
const toIso = (v: string) => { const guess = new Date(v + 'Z'); const il = new Date(guess.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })); const utc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' })); return new Date(guess.getTime() - (il.getTime() - utc.getTime())).toISOString(); };
const step = (l: L) => l.recorded_at || ['recorded', 'delivered'].includes(l.booking_status ?? '') ? 4 : l.booking_id || l.studio_date ? 3 : ['scoping', 'negotiation', 'engaged'].includes(l.stage) ? 2 : l.wa_opened_at ? 1 : 0;
const ago = (d: string) => { const h = (Date.now() - +new Date(d)) / 36e5; return h < 1 ? 'עכשיו' : h < 24 ? `לפני ${Math.round(h)} שע׳` : `לפני ${Math.round(h / 24)} ימים`; };
const FILTERS: [string, string, (l: L) => boolean][] = [['all', 'הכול', () => true], ['new', 'לא פנית', (l) => step(l) === 0 && l.stage !== 'lost'],
  ['talk', 'בתהליך', (l) => [1, 2].includes(step(l)) && l.stage !== 'lost'], ['booked', 'הזמינו', (l) => step(l) >= 3], ['lost', 'לא רלוונטי', (l) => l.stage === 'lost']];

export function LoudLeads({ leads }: { leads: L[] }) {
  const r = useRouter(); const [f, setF] = useState('new'); const [busy, setBusy] = useState(''); const [open, setOpen] = useState<string | null>(null);
  const count = (k: string) => leads.filter(FILTERS.find((x) => x[0] === k)![2]).length;
  const list = leads.filter(FILTERS.find((x) => x[0] === f)![2]);
  const wa = (l: L) => { const u = waLink(l.phone, l.wa_text); if (!u) return; window.open(u, '_blank'); supabaseBrowser().rpc('office_lead_wa_opened', { p_lead: l.id }).then(() => r.refresh()); };
  const [edit, setEdit] = useState<string | null>(null); const [when, setWhen] = useState('');
  const saveDate = async (l: L) => { if (!when) return; setBusy(l.id); await supabaseBrowser().rpc('office_lead_set_studio_date', { p_lead: l.id, p_at: toIso(when) }); setBusy(''); setEdit(null); r.refresh(); };
  const sendIntake = (l: L) => { const u = waLink(l.phone, (l.booked_text ?? '').replace('{{link}}', `${location.origin}/podcast?l=${l.id}`)); if (u) window.open(u, '_blank'); };
  const setStage = async (l: L, stage: string) => { setBusy(l.id); await callAction('update_lead', { id: l.id, version: l.version, stage }).catch(() => null); setBusy(''); r.refresh(); };
  return <section className="card ll">
    <div className="row"><h2 className="sp">🎯 לידים מהטופס</h2><span className="muted small">{leads.length} ב-120 הימים האחרונים</span></div>
    <div className="ll-kpis">
      <div><b>{count('new')}</b><span>לא פנית עדיין</span></div><div><b>{count('talk')}</b><span>בתהליך</span></div>
      <div><b>{count('booked')}</b><span>הזמינו הקלטה</span></div><div><b>{leads.length ? Math.round((count('booked') / leads.length) * 100) : 0}%</b><span>המרה</span></div>
    </div>
    <div className="ll-tabs">{FILTERS.map(([k, t]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{t} <i>{count(k)}</i></button>)}</div>
    {!list.length ? <p className="muted small" style={{ textAlign: 'center', padding: 18 }}>אין לידים כאן.</p> : <div className="ll-list">{list.map((l) => { const s = step(l); const name = l.first_name_he || l.contact_name || l.company || 'ליד';
      return <div key={l.id} className={`ll-card ${l.stage === 'lost' ? 'lost' : ''}`}>
        <div className="ll-top"><span className="av">{name.slice(0, 1)}</span>
          <div className="sp"><b>{name}</b>{l.contact_name && l.contact_name !== name && <small className="muted"> · {l.contact_name}</small>}<div className="small muted" dir="ltr" style={{ textAlign: 'right' }}>{l.phone ?? ''}</div></div>
          <small className="muted">{ago(l.created_at)}</small></div>
        <div className="ll-steps">{STEPS.map((t, i) => <span key={t} className={i <= s ? 'done' : ''}><i />{t}</span>)}</div>
        {l.need && <button className="ll-need" onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? l.need : l.need.split('\n').slice(0, 2).join(' · ').slice(0, 110)}</button>}
        {l.stage !== 'lost' && !l.booking_id && <div className="ll-book">
          {edit === l.id ? <><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              <button className="btn y" disabled={!when || busy === l.id} onClick={() => saveDate(l)}>שמירת מועד</button>
              <button className="btn ghost" onClick={() => setEdit(null)}>ביטול</button></>
            : l.studio_date ? <><span className="ll-date">📅 מועד מתואם: <b>{fmt(l.studio_date)}</b></span>
              {l.phone && <button className="btn wa-send" onClick={() => sendIntake(l)}>📝 שליחת טופס היכרות</button>}
              <button className="btn ghost" onClick={() => { setWhen(local(l.studio_date)); setEdit(l.id); }}>שינוי מועד</button></>
            : <button className="btn" onClick={() => { setWhen(''); setEdit(l.id); }}>📅 שיבצתי מועד</button>}
        </div>}
        {l.starts_at && <p className="small">🎙️ הקלטה: {new Date(l.starts_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>}
        <div className="ll-actions">
          {l.phone && <button className="btn wa-send" onClick={() => wa(l)}>{l.wa_opened_at ? 'וואטסאפ שוב' : '💬 פתיחה בוואטסאפ'}</button>}
          <Link className="btn" href={`/leads/${l.id}`} scroll={false}>כרטיס ליד</Link>
          {s < 2 && l.stage !== 'lost' && <button className="btn" disabled={busy === l.id} onClick={() => setStage(l, 'scoping')}>ענה · בשיחה</button>}
          {l.stage !== 'lost' ? <button className="btn ghost" disabled={busy === l.id} onClick={() => setStage(l, 'lost')}>לא רלוונטי</button>
            : <button className="btn ghost" disabled={busy === l.id} onClick={() => setStage(l, 'new')}>החזרה</button>}
        </div>
      </div>; })}</div>}
  </section>;
}
