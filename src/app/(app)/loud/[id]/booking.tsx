'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';

const TZ = 'Asia/Jerusalem';
const fd = (s: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, ...o }).format(new Date(s));
const money = (n: number) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
const STEPS: [string, string[]][] = [['טופס', []], ['מחקר ושאלות', ['intake']], ['אישור שלך', ['questions_review', 'changes_requested']], ['אישור האורח', ['client_review']], ['תשלום', ['awaiting_payment']], ['מועד', ['paid']], ['הקלטה', ['scheduled']], ['חומרים', ['recorded', 'delivered']]];
const MSG: Record<string, string> = { draft: 'מתוזמנת', pending_approval: 'ממתינה לאישורך', needs_review: 'לבדיקה', sending: 'נשלחת', accepted: 'נשלחה', delivered: 'נמסרה', read: 'נקראה', failed: 'נכשלה', cancelled: 'בוטלה', saved_later: 'נשמרה' };

export function BookingView({ b, link }: { b: any; link: string }) {
  const r = useRouter(); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [kit, setKit] = useState<any>(b.kit); const [dirty, setDirty] = useState(false); const [comment, setComment] = useState(''); const [slot, setSlot] = useState('');
  const [pkg, setPkg] = useState({ title: b.package_title ?? '', price: b.price, description: b.package_desc ?? '', vat_mode: b.vat_mode });
  const [dl, setDl] = useState({ title: '', url: '' }); const [copied, setCopied] = useState(false);
  const cur = Math.max(1, STEPS.findIndex(([, s]) => s.includes(b.status))); const it = b.intake ?? {};
  async function act(a: string, p: any = {}, ok = 'בוצע ✓') {
    setBusy(a); setMsg(null);
    try { const d = await callAction(a, { booking_id: b.id, ...p }); setMsg({ ok: true, t: d?.draft_id ? `${ok} · ההודעה ממתינה לאישורך בלשונית לטיפולי` : ok }); setDirty(false); r.refresh(); }
    catch (e) { setMsg({ ok: false, t: heError(e) }); } finally { setBusy(''); }
  }
  const upd = (si: number, qi: number | null, k: string, v: any) => { const k2 = structuredClone(kit); if (qi == null) k2.segments[si][k] = v; else k2.segments[si].questions[qi][k] = v; setKit(k2); setDirty(true); };
  const nQ = kit ? kit.segments.reduce((a: number, s: any) => a + (s.questions?.length ?? 0), 0) : 0;
  const mins = kit ? kit.segments.reduce((a: number, s: any) => a + Number(s.minutes || 0), 0) : 0;

  return <div className="ldo ldo-b">
    <section className="ldo-bhead">
      <Link href="/loud" className="ldo-back">→ אולפן LOUD</Link>
      <div className="ldo-bhead-in"><span className="ldo-av lg">{(it.name ?? '?').slice(0, 1)}</span>
        <div><h1>{it.name}</h1><p>{b.client?.name}{it.role ? ` · ${it.role}` : ''}</p>
          <div className="row">{b.contact?.phone && <a className="ldo-chip k" href={`tel:${b.contact.phone}`} dir="ltr">{b.contact.phone}</a>}{b.contact?.email && <a className="ldo-chip k" href={`mailto:${b.contact.email}`}>{b.contact.email}</a>}
            {b.client?.id && <Link className="ldo-chip k" href={`/clients/${b.client.id}`}>כרטיס לקוח ←</Link>}{b.request_id && <Link className="ldo-chip k" href={`/room/${b.request_id}`}>חדר הסוכנים ←</Link>}</div></div>
        <div className="ldo-bhead-a"><button className="ldo-btn ghost" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? 'הועתק ✓' : '🔗 עמוד האורח'}</button><a className="ldo-btn ghost" href={link} target="_blank" rel="noreferrer">צפייה כאורח ↗</a></div></div>
      <ol className="ldo-steps">{STEPS.map(([l], i) => <li key={l} className={b.status === 'cancelled' ? '' : i < cur ? 'ok' : i === cur ? 'on' : ''}><b>{i < cur ? '✓' : i + 1}</b><span>{l}</span></li>)}</ol>
    </section>

    {msg && <div className={`ldo-flash ${msg.ok ? 'ok' : 'bad'}`} role="status">{msg.t}</div>}

    <section className="ldo-next-act">{nextAction()}</section>

    <div className="ldo-grid">
      <div className="ldo-main">
        {kit ? <section className="card ldo-kit">
          <div className="row"><div><h2>קובץ השאלות</h2><p className="muted small">גרסה {b.kit_version} · כ-{mins} דק׳ · {nQ} שאלות · אפשר לערוך כל שאלה ישירות</p></div><span className="sp" />
            {dirty && <button className="btn y" disabled={!!busy} onClick={() => act('studio_save_kit', { kit }, 'השינויים נשמרו')}>{busy === 'studio_save_kit' ? '…' : 'שמירת שינויים'}</button>}</div>
          {kit.angle && <div className="ldo-angle"><b>הזווית</b>{kit.angle}</div>}
          {kit.guest_bio && <details className="ldo-bio"><summary>על האורח/ת (מהמחקר)</summary><p>{kit.guest_bio}</p>{kit.research_notes?.length > 0 && <ul>{kit.research_notes.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>}</details>}
          {kit.opener && <div className="ldo-q-open"><b>פתיח</b><textarea value={kit.opener} onChange={(e) => { setKit({ ...kit, opener: e.target.value }); setDirty(true); }} rows={2} /></div>}
          {kit.segments.map((s: any, si: number) => <div key={si} className="ldo-seg">
            <header><b>{si + 1}</b><input value={s.title} onChange={(e) => upd(si, null, 'title', e.target.value)} /><input type="number" className="mins" value={s.minutes} onChange={(e) => upd(si, null, 'minutes', +e.target.value)} /><span>דק׳</span></header>
            {s.key_point && <div className="ldo-kp-tag">🎯 {s.key_point}</div>}
            {s.questions.map((q: any, qi: number) => <div key={qi} className="ldo-q"><textarea value={q.q} onChange={(e) => upd(si, qi, 'q', e.target.value)} rows={2} />
              {q.followups?.length > 0 && <div className="ldo-fu">{q.followups.map((f: string, i: number) => <span key={i}>↳ {f}</span>)}</div>}
              {q.note && <div className="ldo-note">💡 {q.note}</div>}
              <button className="ldo-x" title="הסר שאלה" onClick={() => { const k2 = structuredClone(kit); k2.segments[si].questions.splice(qi, 1); setKit(k2); setDirty(true); }}>✕</button></div>)}
            <button className="btn sm ghost" onClick={() => { const k2 = structuredClone(kit); k2.segments[si].questions.push({ q: '', followups: [], note: '' }); setKit(k2); setDirty(true); }}>＋ שאלה</button>
          </div>)}
          {kit.closer && <div className="ldo-q-open"><b>סגירה</b><textarea value={kit.closer} onChange={(e) => { setKit({ ...kit, closer: e.target.value }); setDirty(true); }} rows={2} /></div>}
          {(kit.clip_ideas?.length > 0 || kit.avoid?.length > 0) && <div className="ldo-two">
            {kit.clip_ideas?.length > 0 && <div><h3>רעיונות לקליפים</h3><ul>{kit.clip_ideas.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>}
            {kit.avoid?.length > 0 && <div><h3>להימנע</h3><ul>{kit.avoid.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>}</div>}
        </section> : <section className="card ldo-wait"><div className="ldo-eq"><i /><i /><i /><i /><i /></div><h2>הסוכנים מכינים את קובץ השאלות</h2>
          <ul className="ldo-tasks">{(b.tasks ?? []).map((t: any, i: number) => <li key={i} className={t.status}><b>{t.status === 'done' ? '✓' : t.status === 'running' ? '●' : '○'}</b>{t.title}{t.stage && t.status === 'running' ? <small> · {t.stage}</small> : null}</li>)}</ul></section>}

        <section className="card"><h2>הודעות לאורח</h2><p className="muted small">כל הודעה נשלחת רק אחרי ״אשר ושלח״ שלך בלשונית לטיפולי. הודעות מתוזמנות יופיעו לאישור בזמן שלהן.</p>
          {(b.messages ?? []).length ? <ul className="ldo-msgs">{b.messages.map((m: any) => <li key={m.id} className={m.status}><div><b>{m.reason}</b><span className="ldo-chip">{MSG[m.status] ?? m.status}</span>{m.scheduled_for && <small>מתוזמן ל-{fd(m.scheduled_for, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>}</div>
            <p>{m.body}</p>{['pending_approval', 'needs_review'].includes(m.status) && <Link className="btn sm y" href={`/approvals?draft=${m.id}`}>לאישור ←</Link>}</li>)}</ul> : <p className="muted">עוד לא נוצרו הודעות.</p>}
        </section>
      </div>

      <aside className="ldo-side">
        <section className="card ldo-intake"><h3>מטופס ההיכרות</h3>
          {it.what_matters && <div><small>מה חשוב לו בפודקאסט</small><p>{it.what_matters}</p></div>}
          <div><small>הקליט בעבר?</small><p>{it.done_before === 'yes' ? `כן${it.done_before_details ? ` · ${it.done_before_details}` : ''}` : 'פעם ראשונה'}</p></div>
          {(it.key_points ?? []).length > 0 && <div><small>3 נקודות מפתח</small><ol>{it.key_points.map((x: string, i: number) => <li key={i}>{x}</li>)}</ol></div>}
          {it.preferred_times && <div><small>מועדים נוחים</small><p>{it.preferred_times}</p></div>}
          <div className="ldo-links">{it.website && <a href={it.website} target="_blank" rel="noreferrer">🌐 אתר</a>}{Object.entries(it.socials ?? {}).map(([k, v]) => <a key={k} href={String(v)} target="_blank" rel="noreferrer">{k}</a>)}</div>
        </section>
        <section className="card"><h3>חבילה ותשלום</h3>
          <div className="ldo-pkg"><input value={pkg.title} onChange={(e) => setPkg({ ...pkg, title: e.target.value })} placeholder="שם החבילה" />
            <div className="row"><input type="number" value={pkg.price} onChange={(e) => setPkg({ ...pkg, price: +e.target.value })} /><select value={pkg.vat_mode} onChange={(e) => setPkg({ ...pkg, vat_mode: e.target.value })}><option value="included">כולל מע״מ</option><option value="plus_vat">+ מע״מ</option><option value="exempt">פטור</option></select></div>
            <textarea value={pkg.description} onChange={(e) => setPkg({ ...pkg, description: e.target.value })} rows={2} placeholder="מה כלול" />
            <button className="btn sm" disabled={!!busy || b.payment?.status === 'paid'} onClick={() => act('studio_set_package', pkg, 'החבילה עודכנה')}>עדכון חבילה / דיל</button></div>
          <div className="ldo-paybox"><span>{b.payment ? ({ paid: '✓ שולם', partial: 'שולם חלקית', link_created: 'נפתח קישור', scheduled: 'ממתין לתשלום', cancelled: 'בוטל' } as any)[b.payment.status] ?? b.payment.status : 'טרם נפתח תשלום'}</span><b>{money(Number(b.price))}</b></div>
          {b.payment && <Link href="/payments" className="small">בלשונית התשלומים ←</Link>}
        </section>
        <section className="card"><h3>מועד באולפן</h3>
          {b.starts_at ? <p className="ldo-when">🎙 {fd(b.starts_at, { weekday: 'long', day: 'numeric', month: 'long' })} · {fd(b.starts_at, { hour: '2-digit', minute: '2-digit' })}</p> : <p className="muted">טרם נקבע</p>}
          {(b.open_slots ?? []).length > 0 && b.status !== 'cancelled' && <div className="row"><select value={slot} onChange={(e) => setSlot(e.target.value)}><option value="">{b.starts_at ? 'החלפת מועד…' : 'קביעה ידנית…'}</option>
            {b.open_slots.map((s: any) => <option key={s.id} value={s.id}>{fd(s.starts_at, { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</option>)}</select>
            <button className="btn sm" disabled={!slot || !!busy} onClick={() => act('studio_book_slot', { slot_id: slot }, 'המועד נקבע · נוצרה תזכורת ליום שלפני')}>קבע</button></div>}
          {!b.open_slots?.length && <Link href="/loud" className="small">אין משבצות פנויות — פתח זמינות ביומן האולפן ←</Link>}
        </section>
        <section className="card"><h3>חומרים לאורח</h3>
          {(b.deliverables ?? []).map((x: any) => <div key={x.id} className="ldo-dl"><a href={x.url} target="_blank" rel="noreferrer">▶ {x.title}</a><button className="ldo-x" onClick={() => act('studio_remove_deliverable', { id: x.id }, 'הוסר')}>✕</button></div>)}
          <div className="ldo-dl-f"><input value={dl.title} onChange={(e) => setDl({ ...dl, title: e.target.value })} placeholder="שם (למשל: ערכה 1 — רילס)" /><input value={dl.url} onChange={(e) => setDl({ ...dl, url: e.target.value })} placeholder="קישור (Drive / Dropbox / YouTube)" dir="ltr" />
            <button className="btn sm" disabled={!/^https?:\/\//.test(dl.url) || !!busy} onClick={() => { act('studio_add_deliverable', dl, 'החומר נוסף'); setDl({ title: '', url: '' }); }}>＋ הוסף</button></div>
        </section>
        {b.status !== 'cancelled' && <button className="btn danger sm" onClick={() => confirm('לבטל את ההזמנה? המשבצת תשתחרר וההודעות הממתינות יבוטלו.') && act('studio_set_status', { status: 'cancelled' }, 'ההזמנה בוטלה')}>ביטול הזמנה</button>}
      </aside>
    </div>
  </div>;

  function nextAction() {
    const B = (a: string, p: any, l: string, ok: string, cls = 'ldo-btn') => <button className={cls} disabled={!!busy} onClick={() => act(a, p, ok)}>{busy === a ? '…' : l}</button>;
    switch (b.status) {
      case 'intake': return <><div><b>הסוכנים עובדים</b><span>סורקים את האתר והרשתות, חוקרים ובונים קובץ שאלות לשעת ראיון. תקבל התראה כשהקובץ מוכן.</span></div></>;
      case 'questions_review': case 'changes_requested': return <><div><b>{b.status === 'changes_requested' ? 'האורח ביקש שינויים' : 'קובץ השאלות מוכן לאישורך'}</b>
        <span>{b.client_feedback ? `״${b.client_feedback}״` : 'עבור על השאלות, ערוך מה שצריך, ואשר. ההודעה לאורח תיווצר ותמתין לאישורך לפני השליחה.'}</span></div>
        <div className="ldo-na-a">{B('studio_approve_kit', { link }, 'אשר ושלח לאורח ✓', 'אושר')}
          <span className="ldo-regen"><input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="הערה לסוכנים לבנייה מחדש…" />{B('studio_regenerate', { comment }, 'בנה מחדש', 'הסוכנים בונים גרסה חדשה', 'ldo-btn ghost')}</span></div></>;
      case 'client_review': return <><div><b>הקובץ אצל האורח</b><span>הוא יכול לאשר או לבקש שינויים מהעמוד האישי שלו. אחרי האישור הוא מועבר אוטומטית לתשלום.</span></div>
        <div className="ldo-na-a">{B('studio_approve_kit', { link }, 'הכן שוב הודעה עם הקישור', 'ההודעה הוכנה', 'ldo-btn ghost')}</div></>;
      case 'awaiting_payment': return <><div><b>האורח אישר ✓ ממתין לתשלום</b><span>{b.package_title} · {money(Number(b.price))}. התשלום נפתח מהעמוד האישי של האורח, וברגע שהוא מתקבל הוא בוחר מועד.</span></div>
        <div className="ldo-na-a">{B('studio_message', { kind: 'loud_pay', reason: 'תזכורת לתשלום ובחירת מועד', body: `היי ${it.name ?? ''} 🎙️ קובץ השאלות מאושר! נשאר רק להשלים תשלום ולבחור מועד באולפן:\n${link}` }, 'הכן תזכורת לתשלום', 'ההודעה הוכנה', 'ldo-btn ghost')}
          {B('studio_set_status', { status: 'paid' }, 'סמן ששולם (במזומן/העברה)', 'סומן כשולם', 'ldo-btn ghost')}</div></>;
      case 'paid': return <><div><b>שולם ✓ ממתין לבחירת מועד</b><span>האורח בוחר מועד מהמשבצות הפנויות בעמוד שלו. אפשר גם לקבוע ידנית מהצד.</span></div>
        <div className="ldo-na-a">{B('studio_message', { kind: 'loud_slot', reason: 'בקשה לבחירת מועד', body: `היי ${it.name ?? ''}, התשלום התקבל, תודה! 🙏 בוחרים מועד להקלטה כאן:\n${link}` }, 'הכן הודעה לבחירת מועד', 'ההודעה הוכנה', 'ldo-btn ghost')}</div></>;
      case 'scheduled': return <><div><b>ההקלטה נקבעה ל-{b.starts_at && fd(b.starts_at, { weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</b><span>תזכורת יום לפני כבר מתוזמנת ותחכה לאישורך. אחרי ההקלטה סמן ״הוקלט״ ונכין הודעת תודה ליום שאחרי.</span></div>
        <div className="ldo-na-a">{B('studio_set_status', { status: 'recorded' }, 'הוקלט ✓', 'סומן כהוקלט · הודעת תודה מתוזמנת למחר')}</div></>;
      case 'recorded': return <><div><b>בעריכה</b><span>הוסף קישורים לחומרים הערוכים מימין, ואז שלח לאורח (ההודעה תמתין לאישורך).</span></div>
        <div className="ldo-na-a">{B('studio_send_materials', {}, 'שלח חומרים לאורח', 'הודעת החומרים הוכנה')}</div></>;
      case 'delivered': return <><div><b>הפרק נמסר 🎧</b><span>זה הזמן לבקש המלצה ולהציע סדרת פרקים.</span></div>
        <div className="ldo-na-a">{B('studio_message', { kind: 'loud_upsell', reason: 'הצעה לסדרת פרקים', body: `היי ${it.name ?? ''}, איך הפרק נקלט אצלך? 🎙️ הרבה אורחים שלנו ממשיכים לסדרה קבועה: 4 פרקים בחודש, עם קליפים ערוכים לכל פרק. רוצה שנבנה לך הצעה?` }, 'הכן הצעה לסדרה', 'ההודעה הוכנה', 'ldo-btn ghost')}
          {B('studio_send_materials', {}, 'שלח שוב חומרים', 'ההודעה הוכנה', 'ldo-btn ghost')}</div></>;
      default: return <div><b>ההזמנה בוטלה</b></div>;
    }
  }
}
