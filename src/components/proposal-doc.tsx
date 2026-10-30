import type { ReactNode } from 'react';

// Branded Pixel proposal (2 A4 pages), modelled on the Studio Pixel retainer proposal. Same component renders the
// internal print view and the client's public signing page, so what the client signs is exactly what was approved.
export type ProposalData = {
  title: string; number?: string | null; created_at?: string; expires_at?: string | null; version_no?: number;
  content: any; price: { setup?: number | null; monthly?: number | null }; totals: any;
  items: { title: string; description?: string | null; price: number }[];
};
const LOGO = 'https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-500.webp';
const nf = (n: number) => new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(n);
const d = (s?: string | null) => (s ? new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(s)) : '');

function Footer({ page }: { page: number }) {
  return <footer className="pq-foot"><span><b>Studio Pixel</b> · משרד פרסום ודיגיטל</span><span className="pq-pg">עמוד {page} מתוך 2</span>
    <span dir="ltr">052-448-8187 · office@s-pixel.co.il · s-pixel.co.il</span></footer>;
}

export function ProposalDoc({ data, signature }: { data: ProposalData; signature?: ReactNode }) {
  const c = data.content ?? {}; const cl = c.client ?? {}; const t = data.totals ?? {};
  const retainer = c.kind === 'retainer'; const price = Number(retainer ? data.price.monthly : data.price.setup);
  const gross = retainer ? t.monthly_with_vat : t.setup_with_vat;
  const vatLine = c.vat_mode === 'included' ? 'כולל מע״מ' : c.vat_mode === 'exempt' ? 'פטור ממע״מ'
    : `לפני מע״מ${gross != null && t.vat_rate != null ? ` · ₪ ${nf(Number(gross))} כולל מע״מ (${Number(t.vat_rate)}%)` : ''}`;
  const blocks: any[] = c.blocks ?? []; const steps: any[] = c.steps ?? [];
  const highlights: any[] = c.highlights ?? [];
  return <div className="pq">
    <section className="pq-page">
      <header className="pq-head"><img src={LOGO} alt="Pixel Digital" className="pq-logo" />
        <div className="pq-meta"><b>הצעת מחיר מס׳ {data.number ?? '—'}</b><div>תאריך: {d(data.created_at)} · בתוקף {c.validity_days ?? 30} יום</div>
          <div>לכבוד: <b>{cl.company}</b></div>{cl.contact_name && <div>לידי: <b>{cl.contact_name}</b></div>}</div></header>
      <div className="pq-hero">
        <span className="pq-pill"><i />STUDIO PIXEL · {retainer ? 'ריטיינר חודשי' : 'פרויקט'}</span>
        <h1>{c.hero_pre ?? (retainer ? 'הזרוע השיווקית של' : 'הצעה עבור')}<br /><span className="pq-cy">{c.hero_name ?? cl.company}</span></h1>
        {c.hero_sub && <p>{c.hero_sub}</p>}
        {highlights.length > 0 && <div className="pq-hl">{highlights.slice(0, 3).map((h, i) => <div key={i}><b className={i === 1 ? 'pq-ye' : ''}>{h.t}</b><span>{h.s}</span></div>)}</div>}
      </div>
      <h2 className="pq-h2"><i />{retainer ? 'תכולת השירות החודשי' : 'תכולת הפרויקט'}</h2>
      <div className="pq-blocks">{blocks.map((b, i) => <div key={i} className={`pq-block ${i % 2 ? 'alt' : ''}`}>
        <small>{b.tag}</small><h3><span className="pq-num">{String(i + 1).padStart(2, '0')}</span>{b.title}</h3>
        <ul>{(b.bullets ?? []).map((x: string, k: number) => <li key={k}>{x}</li>)}</ul></div>)}</div>
      <Footer page={1} />
    </section>

    <section className="pq-page">
      <header className="pq-head"><img src={LOGO} alt="Pixel Digital" className="pq-logo" /><span className="pq-pill light"><i />ההשקעה ותהליך העבודה</span></header>
      <h2 className="pq-h2"><i />ההשקעה</h2>
      <div className={`pq-invest ${data.items.length ? '' : 'one'}`}>
        <div className="pq-price"><small>{retainer ? 'ריטיינר חודשי' : 'עלות הפרויקט'}</small>
          <div className="pq-big"><span className="pq-cur">₪</span>{nf(price)}</div>
          <div className="pq-vat">{retainer ? 'לחודש, ' : ''}{vatLine}</div>
          {c.price_note && <p>{c.price_note}</p>}
          {retainer && c.media_note !== false && <p>{c.media_note ?? 'תקציב המדיה לקמפיינים משולם ישירות לפלטפורמות ונקבע בנפרד, לפי החלטתכם.'}</p>}</div>
        {data.items.map((it, i) => <div key={i} className="pq-addon"><span className="pq-pill light"><i />אופציה · בתיאום מראש</span>
          <h3>{it.title}</h3><div className="pq-mid"><span className="pq-cur">₪</span>{nf(Number(it.price))}</div>
          {it.description && <ul>{it.description.split('\n').filter(Boolean).map((x, k) => <li key={k}>{x}</li>)}</ul>}</div>)}
      </div>
      {steps.length > 0 && <><h2 className="pq-h2"><i />איך מתחילים</h2>
        <ol className="pq-steps">{steps.slice(0, 4).map((s, i) => <li key={i}><span className={`pq-dot ${i === steps.length - 1 ? 'y' : ''}`}>{i + 1}</span><b>{s.t}</b><small>{s.s}</small></li>)}</ol></>}
      <div className="pq-cta"><b>{c.cta ?? 'מוכנים להתחיל? נצא לדרך כבר החודש.'}</b><span dir="ltr">055-989-0308 · 052-448-8187</span></div>
      <div className="pq-sign">
        <div><b>אישור הלקוח</b>{signature ?? <span className="muted">שם, חתימה ותאריך</span>}</div>
        <div><b>Studio Pixel · פיקסל דיגיטל</b><span className="muted">כיכר בן גוריון 2, קרית טבעון</span></div>
      </div>
      <Footer page={2} />
    </section>
  </div>;
}
