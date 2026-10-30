'use client';
import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';
import { SERVICES, SERVICE_BY_KEY, VAT_MODE_HE } from '@/lib/services';

type Lead = { id: string; company: string; contact_name?: string | null; industry?: string | null; requested_services?: string[] | null };
const STEPS = { retainer: [{ t: 'פגישת התנעה', s: 'היכרות, יעדים וחיבור הנכסים הדיגיטליים' }, { t: 'אסטרטגיה ותוכן', s: 'מסרים, תוכנית עבודה ולוח תוכן' }, { t: 'עלייה לאוויר', s: 'סושיאל, קמפיינים וקידום' }, { t: 'שיפור מתמיד', s: 'אופטימיזציה ודוח חודשי' }],
  one_time: [{ t: 'אפיון', s: 'פגישת היכרות, יעדים ותכולה מדויקת' }, { t: 'עיצוב', s: 'קונספט, סבבי תיקון ואישור' }, { t: 'פיתוח והפקה', s: 'בנייה, תוכן ובדיקות' }, { t: 'מסירה', s: 'עלייה לאוויר, הדרכה וליווי' }] };

/** Owner: branded proposal from the lead — kind, services, price (owner's price is the source of truth), VAT, add-on. */
type Pkg = { id: string; name: string; kind: 'retainer' | 'one_time'; services: string[]; price: number | null; vat_mode: string; description?: string | null; addon_title?: string | null; addon_price?: number | null };
export function QuickProposal({ lead, terms, packages = [] }: { lead: Lead; terms: { id: string; name: string }[]; packages?: Pkg[] }) {
  const r = useRouter();
  const init = (lead.requested_services ?? []).filter((k) => SERVICE_BY_KEY[k]);
  const [kind, setKind] = useState<'retainer' | 'one_time'>(init.some((k) => SERVICE_BY_KEY[k].kind === 'one_time') && !init.some((k) => SERVICE_BY_KEY[k].kind === 'retainer') ? 'one_time' : 'retainer');
  const [svc, setSvc] = useState<string[]>(init); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const [pkg, setPkg] = useState<string | null>(null); const [price, setPrice] = useState(''); const [vat, setVat] = useState('plus_vat'); const [addon, setAddon] = useState({ t: '', p: '' });
  const pick = (p: Pkg) => { setPkg(p.id); setKind(p.kind); setSvc(p.services.filter((k) => SERVICE_BY_KEY[k])); setVat(p.vat_mode || 'plus_vat'); setAddon({ t: p.addon_title ?? '', p: '' }); };
  const shown = useMemo(() => SERVICES.filter((s) => s.kind === kind || svc.includes(s.key)), [kind, svc]);
  const defSub = kind === 'retainer'
    ? `כל הפעילות השיווקית תחת צוות אחד: ${svc.map((k) => SERVICE_BY_KEY[k]?.label).filter(Boolean).join(', ')}. המטרה: שלקוחות יכירו, יסמכו ויפנו.`
    : `${svc.map((k) => SERVICE_BY_KEY[k]?.label).filter(Boolean).join(' + ')} — מקצה לקצה, בשפה ממותגת ומדויקת ל${lead.company}.`;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? '').trim();
    if (!svc.length) { setMsg('בחר לפחות שירות אחד'); return; }
    const content = {
      hero_pre: v('hero_pre') || (kind === 'retainer' ? 'הזרוע השיווקית של' : 'הצעה עבור'), hero_name: v('hero_name') || lead.company, hero_sub: v('hero_sub') || defSub,
      highlights: kind === 'retainer' ? [{ t: 'צוות אחד', s: 'כל הערוצים תחת קורת גג אחת' }, { t: svc.includes('seo') || svc.includes('geo') ? 'SEO · GEO' : 'קריאייטיב', s: svc.includes('seo') || svc.includes('geo') ? 'נראות בגוגל ובמנועי AI' : 'תוכן ועיצוב ממותגים' }, { t: 'דוח חודשי', s: 'שקיפות מלאה על הביצועים' }]
        : [{ t: 'מקצה לקצה', s: 'אפיון, עיצוב, ביצוע ומסירה' }, { t: 'ממותג', s: 'שפה גרפית מדויקת לעסק' }, { t: 'ליווי', s: 'הדרכה ותמיכה אחרי המסירה' }],
      blocks: svc.map((k) => { const s = SERVICE_BY_KEY[k]; return { key: k, tag: s.tag, title: s.title, bullets: s.bullets }; }),
      services: svc.map((k) => SERVICE_BY_KEY[k].label), steps: STEPS[kind], price_note: v('price_note') || undefined, cta: v('cta') || undefined,
    };
    const addons = v('addon_title') && v('addon_price') ? [{ title: v('addon_title'), price: v('addon_price'), description: v('addon_desc') }] : [];
    setBusy(true); setMsg('');
    try { const d = await callAction('quick_proposal', { lead_id: lead.id, kind, price: v('price'), vat_mode: v('vat_mode'), terms_template_id: v('terms_template_id'),
        validity_days: v('validity_days'), title: `הצעת מחיר — ${lead.company}`, content, addons });
      r.push(`/proposals/${d.id}`); }
    catch (err) { setMsg(heError(err)); } finally { setBusy(false); }
  }
  return <form className="f" onSubmit={submit}>
    {packages.length > 0 && <div className="pkg-pick"><span className="small muted">חבילה מוכנה (ממלא שירותים ומחיר — אפשר לשנות)</span>
      <div className="pkg-row">{packages.map((p) => <button type="button" key={p.id} className={`pkg ${pkg === p.id ? 'on' : ''}`} onClick={() => pick(p)}><b>{p.name}</b><small>{p.services.length} שירותים · מחיר ידני</small></button>)}</div></div>}
    <div className="row" role="radiogroup">{(['retainer', 'one_time'] as const).map((k) => <button type="button" key={k} className={`btn ${kind === k ? 'y' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'retainer' ? 'ריטיינר חודשי' : 'פרויקט חד-פעמי'}</button>)}</div>
    <fieldset className="chips"><legend className="small muted">שירותים בהצעה *</legend>
      {shown.map((s) => <label key={s.key} className={`chip ${svc.includes(s.key) ? 'on' : ''}`}><input type="checkbox" checked={svc.includes(s.key)} onChange={() => setSvc((x) => x.includes(s.key) ? x.filter((y) => y !== s.key) : [...x, s.key])} />{s.label}</label>)}</fieldset>
    <div className="grid g2">
      <label>{kind === 'retainer' ? 'מחיר חודשי (₪) *' : 'מחיר הפרויקט (₪) *'}<input name="price" type="number" step="any" min="1" required value={price} onChange={(e) => setPrice(e.target.value)} /></label>
      <label>מע״מ *<select name="vat_mode" required value={vat} onChange={(e) => setVat(e.target.value)}>{Object.entries(VAT_MODE_HE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label>תבנית מע״מ<select name="terms_template_id" defaultValue={terms[0]?.id ?? ''}><option value="">—</option>{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <span className="hint">כדי להציג גם את הסכום כולל מע״מ</span></label>
      <label>תוקף ההצעה (ימים)<input name="validity_days" type="number" defaultValue={30} min="1" /></label></div>
    <details><summary className="small"><b>כותרת ועיצוב</b> (אופציונלי)</summary><div className="f" style={{ marginTop: 8 }}>
      <div className="grid g2"><label>שורת פתיחה<input name="hero_pre" placeholder={kind === 'retainer' ? 'הזרוע השיווקית של' : 'הצעה עבור'} /></label><label>שם מודגש<input name="hero_name" placeholder={lead.company} /></label></div>
      <label>תיאור<textarea name="hero_sub" placeholder={defSub} /></label><label>הערת מחיר<input name="price_note" placeholder="כולל את כל רכיבי השירות" /></label><label>משפט סיום<input name="cta" placeholder="מוכנים להתחיל? נצא לדרך כבר החודש." /></label></div></details>
    <details><summary className="small"><b>תוספת אופציונלית</b> (למשל יום צילום רבעוני)</summary><div className="f" style={{ marginTop: 8 }}>
      <div className="grid g2"><label>שם התוספת<input name="addon_title" value={addon.t} onChange={(e) => setAddon({ ...addon, t: e.target.value })} /></label><label>מחיר (₪)<input name="addon_price" type="number" step="any" value={addon.p} onChange={(e) => setAddon({ ...addon, p: e.target.value })} /></label></div>
      <label>פירוט (שורה לכל סעיף)<textarea name="addon_desc" /></label></div></details>
    <div className="row"><button className="btn y" disabled={busy}>{busy ? 'יוצר…' : 'צור הצעת מחיר ממותגת'}</button>{msg && <span className="small" style={{ color: 'var(--bad)' }}>{msg}</span>}</div>
  </form>;
}
