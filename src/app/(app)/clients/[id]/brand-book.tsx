import { fmtDateTime } from '@/lib/format';
import { logoOf } from '@/lib/logo';

// Layout rule (Tal): a group is either all in one row or all stacked — never 2+1. Pick a column count that divides the group,
// otherwise fall back to a single horizontal rail. Mobile always stacks (see .bb-grid in globals.css).
export function colsFor(n: number, max = 4) {
  if (n <= max) return { cls: 'bb-grid', style: { gridTemplateColumns: `repeat(${Math.max(n, 1)}, minmax(0,1fr))` } };
  for (let c = max; c >= 2; c--) if (n % c === 0) return { cls: 'bb-grid', style: { gridTemplateColumns: `repeat(${c}, minmax(0,1fr))` } };
  return { cls: 'bb-rail', style: {} };
}
export function Grid({ n, max, children }: { n: number; max?: number; children: React.ReactNode }) {
  const g = colsFor(n, max); return <div className={g.cls} style={g.style}>{children}</div>;
}
const arr = (x: any) => (Array.isArray(x) ? x : []);
const NET_HE: Record<string, string> = { instagram: 'אינסטגרם', facebook: 'פייסבוק', tiktok: 'טיקטוק', youtube: 'יוטיוב', linkedin: 'לינקדאין', whatsapp: 'וואטסאפ', website: 'אתר', google: 'גוגל', x: 'X' };
const netHe = (n?: string) => NET_HE[(n ?? '').toLowerCase()] ?? n ?? '';
const STATUS_HE: Record<string, [string, string]> = { public: ['ציבורי', 'ok'], requires_login: ['דורש התחברות', 'warn'], not_found: ['לא נמצא', 'bad'], error: ['לא נגיש', 'bad'] };

export function Section({ n, title, sub, children }: { n: string; title: string; sub?: string; children: React.ReactNode }) {
  return <section className="bb-sec"><header><span className="bb-n">{n}</span><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div></header>{children}</section>;
}
const Chips = ({ items, tone = '' }: { items: string[]; tone?: string }) => items.length ? <div className="bb-chips">{items.map((t, i) => <span key={i} className={`bb-chip ${tone}`}>{t}</span>)}</div> : null;
const List = ({ items }: { items: string[] }) => items.length ? <ul className="bb-list">{items.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="muted small">אין נתונים</p>;

export function BrandBook({ client, actions }: { client: any; actions?: React.ReactNode }) {
  const d = client.profile?.dossier ?? {}; const x = client.profile?.dossier_extra ?? {};
  const brand = d.brand ?? {}; const biz = d.business ?? {}; const sv = d.social_voice ?? {}; const rep = d.reputation ?? {}; const lib = d.content_library ?? {};
  const colors: { hex: string; role?: string }[] = (arr(brand.colors).length ? arr(brand.colors) : arr(x.colors)).filter((c: any) => /^#?[0-9a-f]{3,8}$/i.test(String(c.hex ?? '').trim())); const nc = colors.length >= 8 ? 8 : colors.length >= 6 ? 6 : Math.min(colors.length, 4); colors.splice(nc);
  const swCols = nc === 8 ? 4 : nc === 6 ? 3 : Math.max(nc, 1);
  const fonts: string[] = [...new Set([...arr(brand.fonts), ...arr(x.fonts)].filter((f: string) => f && !/^-|system|sans-serif|serif$/i.test(f)))].slice(0, 4);
  const lg = logoOf(client.profile); const logo = lg.src;
  return <div className="bb">
    <div className="bb-hero">
      <div className={`bb-logo${lg.dark ? ' dk' : ''}`}>{logo ? <img src={logo} alt={`לוגו ${client.name}`} /> : <span>{client.name?.[0]}</span>}</div>
      <div className="bb-hero-txt">
        <small>תיק לקוח · מחקר אוטומטי{client.profile?.research_at ? ` · ${fmtDateTime(client.profile.research_at)}` : ''}</small>
        <h2>{client.name}</h2>
        {d.summary && <p>{d.summary}</p>}
        <div className="bb-hero-meta">{x.website && <a href={x.website} target="_blank" rel="noreferrer">🌐 {x.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>}
          {arr(d.sources).length > 0 && <span>{arr(d.sources).length} מקורות</span>}{arr(lib.post_ideas).length > 0 && <span>{arr(lib.post_ideas).length} רעיונות לתוכן</span>}</div>
      </div>
      {actions && <div className="bb-hero-act">{actions}</div>}
    </div>

    <nav className="bb-toc">{[['brand', 'מותג'], ['biz', 'העסק'], ['aud', 'קהלים'], ['comp', 'מתחרים'], ['digital', 'נוכחות דיגיטלית'], ['voice', 'שפת הרשתות'], ['lib', 'ספריית תוכן'], ['opp', 'הזדמנויות'], ['src', 'מקורות']].map(([k, l]) => <a key={k} href={`#bb-${k}`}>{l}</a>)}</nav>

    <div id="bb-brand"><Section n="01" title="ספר מותג" sub="טון, ערכים, בידול, צבעים ופונטים — כפי שעלו מהאתר ומהרשתות">
      <div className="bb-two">
        <div className="bb-card"><h3>הטון</h3><p className="bb-lead">{brand.voice || '—'}</p><Chips items={arr(brand.tone_words)} tone="c" />
          {arr(brand.values).length > 0 && <><h4>ערכים</h4><Chips items={arr(brand.values)} /></>}</div>
        <div className="bb-card"><h3>פלטת צבעים</h3>
          {colors.length ? <div className="bb-swatches" style={{ gridTemplateColumns: `repeat(${swCols}, minmax(0,1fr))` }}>{colors.map((c, i) => { const hex = c.hex.startsWith('#') ? c.hex : `#${c.hex}`;
            return <div key={i} className="bb-sw"><i style={{ background: hex }} /><b dir="ltr">{hex.toUpperCase()}</b><span>{c.role ?? (i === 0 ? 'עיקרי' : '')}</span></div>; })}</div> : <p className="muted small">לא זוהו צבעים</p>}
          <h4>פונטים</h4>{fonts.length ? <div className="bb-fonts">{fonts.map((f) => <div key={f} style={{ fontFamily: `'${f}', Assistant, sans-serif` }}><span>אבג Aa 123</span><small dir="ltr">{f}</small></div>)}</div> : <p className="muted small">לא זוהו</p>}</div>
      </div>
      {arr(brand.differentiators).length > 0 && <><h3 className="bb-h3">מה מבדל אותם</h3><Grid n={arr(brand.differentiators).length} max={3}>{arr(brand.differentiators).map((t: string, i: number) => <div key={i} className="bb-card bb-diff"><b>{String(i + 1).padStart(2, '0')}</b><p>{t}</p></div>)}</Grid></>}
      {arr(brand.messages).length > 0 && <><h3 className="bb-h3">מסרים מרכזיים</h3><Grid n={arr(brand.messages).length} max={3}>{arr(brand.messages).map((t: string, i: number) => <blockquote key={i} className="bb-quote">{t}</blockquote>)}</Grid></>}
    </Section></div>

    <div id="bb-biz"><Section n="02" title="העסק" sub="מי הם, מה הם מוכרים ואיך יוצרים איתם קשר">
      {biz.about && <p className="bb-lead">{biz.about}</p>}
      {arr(biz.services).length > 0 && <Grid n={arr(biz.services).length} max={4}>{arr(biz.services).map((s: any, i: number) => <div key={i} className="bb-card"><h4>{s.name}</h4><p className="small">{s.description}</p></div>)}</Grid>}
      <div className="bb-two" style={{ marginTop: 14 }}>
        <div className="bb-card"><h3>פרטי קשר</h3><dl className="bb-kv">
          {arr(biz.contact?.phones).length > 0 && <><dt>טלפון</dt><dd dir="ltr">{arr(biz.contact.phones).join(' · ')}</dd></>}
          {arr(biz.contact?.emails).length > 0 && <><dt>אימייל</dt><dd dir="ltr">{arr(biz.contact.emails).join(' · ')}</dd></>}
          {biz.contact?.address && <><dt>כתובת</dt><dd>{biz.contact.address}</dd></>}
          {arr(biz.locations).length > 0 && <><dt>אזורי פעילות</dt><dd>{arr(biz.locations).join(' · ')}</dd></>}</dl></div>
        <div className="bb-card"><h3>שאלות נפוצות</h3>{arr(biz.faq).length ? arr(biz.faq).map((f: any, i: number) => <details key={i} className="bb-faq"><summary>{f.q}</summary><p>{f.a}</p></details>) : <p className="muted small">אין</p>}</div>
      </div>
    </Section></div>

    <div id="bb-aud"><Section n="03" title="קהלי יעד ופרסונות">
      <Grid n={arr(d.audiences).length} max={3}>{arr(d.audiences).map((a: any, i: number) => <div key={i} className="bb-card bb-persona">
        <div className="bb-persona-h"><span>{(a.name ?? '?').trim()[0]}</span><h4>{a.name}</h4></div>
        {arr(a.pains).length > 0 && <><h5>כאבים</h5><List items={arr(a.pains)} /></>}
        {arr(a.motivations).length > 0 && <><h5>מה מניע אותם</h5><List items={arr(a.motivations)} /></>}
        {arr(a.channels).length > 0 && <><h5>איפה הם</h5><Chips items={arr(a.channels)} tone="c" /></>}</div>)}</Grid>
      {!arr(d.audiences).length && <p className="muted small">לא זוהו קהלים</p>}
    </Section></div>

    <div id="bb-comp"><Section n="04" title="מתחרים" sub="החוזקות שלהם, והפער שאפשר לנצל">
      <Grid n={arr(d.competitors).length} max={3}>{arr(d.competitors).map((c: any, i: number) => <div key={i} className="bb-card bb-comp">
        <h4>{c.url ? <a href={c.url} target="_blank" rel="noreferrer">{c.name}</a> : c.name}</h4>
        <div className="bb-comp-row"><span className="bb-tag">חוזקות</span><p>{c.strengths || '—'}</p></div>
        <div className="bb-comp-row gap"><span className="bb-tag y">הפער שלנו</span><p>{c.gap || '—'}</p></div></div>)}</Grid>
      {!arr(d.competitors).length && <p className="muted small">לא זוהו מתחרים</p>}
    </Section></div>

    <div id="bb-digital"><Section n="05" title="נוכחות דיגיטלית">
      <Grid n={arr(d.digital_presence).length || arr(x.socials).length} max={4}>{(arr(d.digital_presence).length ? arr(d.digital_presence) : arr(x.socials).map((s: any) => ({ network: s.network, url: s.url, status: s.status }))).map((p: any, i: number) => {
        const st = STATUS_HE[p.status] ?? [p.status, 'muted'];
        return <div key={i} className="bb-card bb-net"><div className="row"><b className="sp">{netHe(p.network)}</b>{p.status && <span className={`badge ${st[1]}`}>{st[0]}</span>}</div>
          {p.url && <a className="small" dir="ltr" href={p.url} target="_blank" rel="noreferrer">{p.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}</a>}
          {p.notes && <p className="small">{p.notes}</p>}{p.recommendation && <p className="bb-reco">→ {p.recommendation}</p>}</div>; })}</Grid>
    </Section></div>

    <div id="bb-voice"><Section n="06" title="שפת הרשתות" sub="איך הם כותבים — הבסיס לכל פוסט שנכתוב עבורם">
      <div className="bb-two">
        <div className="bb-card"><h3>הסגנון</h3><p className="bb-lead">{sv.style || '—'}</p><dl className="bb-kv">
          {sv.caption_length && <><dt>אורך טקסט</dt><dd>{sv.caption_length}</dd></>}{sv.emoji_use && <><dt>אימוג׳י</dt><dd>{sv.emoji_use}</dd></>}{sv.visual_style && <><dt>ויזואל</dt><dd>{sv.visual_style}</dd></>}</dl>
          {arr(sv.formats_that_work).length > 0 && <><h4>פורמטים שעובדים</h4><Chips items={arr(sv.formats_that_work)} tone="c" /></>}
          {arr(sv.hashtags).length > 0 && <><h4>האשטגים</h4><Chips items={arr(sv.hashtags)} /></>}</div>
        <div className="bb-card"><h3>הוקים שעובדים</h3>{arr(sv.hooks).length ? arr(sv.hooks).map((h: string, i: number) => <div key={i} className="bb-hook">„{h}"</div>) : <p className="muted small">יתווספו אחרי איסוף דוגמאות מהרשתות</p>}</div>
      </div>
      {(arr(sv.do).length > 0 || arr(sv.dont).length > 0) ? <div className="bb-two" style={{ marginTop: 14 }}>
        <div className="bb-card bb-do"><h3>✓ כן</h3><List items={arr(sv.do)} /></div>
        <div className="bb-card bb-dont"><h3>✕ לא</h3><List items={arr(sv.dont)} /></div>
      </div> : <div className="bb-empty" style={{ marginTop: 14 }}><b>שפת הרשתות עוד לא כוילה</b><p>לא נאספו פוסטים מהרשתות של הלקוח (אינסטגרם, טיקטוק ופוסטים בפייסבוק דורשים התחברות). חיבור Meta במסך החיבורים, או הוספת קישורים לפוסטים בבנק הנכסים, ישלימו את הכיול.</p><a className="btn sm" href="?tab=assets">לבנק הנכסים</a></div>}
      {(rep.summary || arr(rep.themes_positive).length > 0) && <div className="bb-card" style={{ marginTop: 14 }}><h3>מוניטין {rep.rating && <span className="badge yellow">{rep.rating}</span>}</h3><p>{rep.summary}</p>
        <div className="bb-two"><div><h4>חיובי</h4><Chips items={arr(rep.themes_positive)} tone="ok" /></div><div><h4>לשיפור</h4><Chips items={arr(rep.themes_negative)} tone="bad" /></div></div></div>}
    </Section></div>

    <div id="bb-lib"><Section n="07" title="ספריית תוכן" sub="עמודי תוכן ורעיונות מוכנים לפוסטים, ביטויי SEO ושאלות למנועי AI">
      {arr(lib.pillars).length > 0 && <Grid n={arr(lib.pillars).length} max={4}>{arr(lib.pillars).map((p: any, i: number) => <div key={i} className="bb-card bb-pillar"><span>{String(i + 1).padStart(2, '0')}</span><h4>{p.name}</h4><p className="small">{p.description}</p></div>)}</Grid>}
      {arr(lib.post_ideas).length > 0 && <><h3 className="bb-h3">רעיונות לפוסטים ({arr(lib.post_ideas).length})</h3>
        <Grid n={arr(lib.post_ideas).length} max={4}>{arr(lib.post_ideas).map((p: any, i: number) => <div key={i} className="bb-idea"><div className="row"><span className="bb-tag">{p.format || 'פוסט'}</span>{p.pillar && <small className="muted">{p.pillar}</small>}</div>
          <h4>{p.title}</h4>{p.hook && <p>„{p.hook}"</p>}</div>)}</Grid></>}
      <div className="bb-two" style={{ marginTop: 14 }}>
        <div className="bb-card"><h3>ביטויי SEO</h3><Chips items={arr(lib.seo_keywords)} /></div>
        <div className="bb-card"><h3>שאלות למנועי AI (AEO/GEO)</h3><List items={arr(lib.aeo_questions)} /></div>
      </div>
    </Section></div>

    <div id="bb-opp"><Section n="08" title="הזדמנויות ושאלות פתוחות">
      <div className="bb-two"><div className="bb-card bb-opp"><h3>הזדמנויות</h3><List items={arr(d.opportunities)} /></div>
        <div className="bb-card"><h3>לשאול את הלקוח</h3><List items={arr(d.open_questions)} /></div></div>
    </Section></div>

    <div id="bb-src"><Section n="09" title="מקורות המחקר">
      <ol className="bb-src">{arr(d.sources).map((s: string, i: number) => <li key={i}>{/^https?:/.test(s) ? <a href={s} target="_blank" rel="noreferrer" dir="ltr">{s.replace(/^https?:\/\/(www\.)?/, '').slice(0, 80)}</a> : s}</li>)}</ol>
    </Section></div>
  </div>;
}

export function AssetBank({ client, assets, addForm }: { client: any; assets: any[]; addForm?: React.ReactNode }) {
  const x = client.profile?.dossier_extra ?? {};
  // once the vision pass ran, trust its result only (older asset rows may still hold client logos)
  const dropped = new Set<string>(arr(x.images_dropped));
  const imgs: string[] = [...new Set((x.images_checked ? [x.og_image, ...arr(x.images)] : [x.og_image, ...arr(x.images), ...assets.filter((a) => a.kind === 'site_image').map((a) => a.identifier)]).filter((u: any) => u && !dropped.has(u)))];
  const logos: string[] = [...new Set([logoOf(client.profile).src, client.profile?.dossier?.brand?.logo_url, x.logo, ...assets.filter((a) => a.kind === 'logo').map((a) => a.identifier)].filter(Boolean))];
  const socials = arr(x.socials).length ? arr(x.socials) : assets.filter((a) => a.kind === 'social_profile').map((a) => ({ network: a.owner_label, url: a.identifier, status: a.access_status }));
  const PRI = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin']; const pri = (n: string) => (PRI.indexOf(n) + 1) || 99;
  const samples = (arr(x.samples).length ? arr(x.samples) : assets.filter((a) => a.kind === 'social_sample').map((a) => ({ network: a.owner_label, url: a.identifier, text: a.notes }))).slice().sort((a: any, b: any) => pri(a.network) - pri(b.network) || (Number(b.views ?? b.likes ?? 0) - Number(a.views ?? a.likes ?? 0)));
  const gaps = arr(x.sample_gaps).filter((n: string) => /כניסה|חיבור|login/i.test(n));
  return <div className="bb">
    <Section n="01" title="לוגו ונכסי מותג">
      {logos.length ? <Grid n={logos.length} max={4}>{logos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="bb-logo-tile"><img src={u} alt="לוגו" /></a>)}</Grid> : <p className="muted small">לא נמצא לוגו</p>}
    </Section>
    <Section n="02" title={`תמונות של החברה מהאתר (${imgs.length})`} sub={x.images_checked ? `סוננו אוטומטית — ${arr(x.images_dropped).length} לוגואים של לקוחות/שותפים הוסרו · לבדיקת זכויות לפני שימוש` : 'לבדיקת זכויות לפני שימוש בפרסום'}>
      {imgs.length ? <div className="bb-gallery">{imgs.slice(0, 40).map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" loading="lazy" /></a>)}</div> : <p className="muted small">לא נאספו תמונות. הרצת מחקר חוזרת תאסוף אותן.</p>}
    </Section>
    <Section n="03" title="פרופילים ברשתות">
      <Grid n={socials.length} max={4}>{socials.map((s: any, i: number) => { const st = STATUS_HE[s.status] ?? [s.status ?? '', 'muted'];
        return <a key={i} href={s.url} target="_blank" rel="noreferrer" className="bb-card bb-net bb-link">{s.image && <img className="bb-av" src={s.image} alt="" />}
          <div className="row"><b className="sp">{netHe(s.network)}</b>{st[0] && <span className={`badge ${st[1]}`}>{st[0]}</span>}</div>
          {s.title && <p className="small">{s.title}</p>}{s.followers_text && <p className="small muted">{s.followers_text}</p>}</a>; })}</Grid>
    </Section>
    <Section n="04" title={`דוגמאות תוכן מהרשתות (${samples.length})`} sub="פוסטים, רילסים וסרטונים לכיול שפת הלקוח">
      {samples.length ? <Grid n={samples.length} max={4}>{samples.map((s: any, i: number) => <a key={i} href={s.url} target="_blank" rel="noreferrer" className="bb-sample">
        {(s.thumb || s.thumbnail || s.image) ? <img src={s.thumb || s.thumbnail || s.image} alt="" loading="lazy" />
          : <div className={`bb-ph n-${s.network}`}><span>{s.type === 'post' ? '❝' : '▶'}</span><b>{netHe(s.network)}</b>{s.views != null && <small>{Number(s.views).toLocaleString('he-IL')} צפיות</small>}</div>}
        <div className="row"><span className="bb-tag">{netHe(s.network)}{s.type ? ` · ${s.type}` : ''}</span>{s.date && <small className="muted">{String(s.date).slice(0, 10)}</small>}</div>
        <p>{String(s.text ?? s.caption ?? '').slice(0, 220)}</p>
        <small className="muted">{[s.author, s.likes != null && `${s.likes} לייקים`, s.views != null && `${Number(s.views).toLocaleString('he-IL')} צפיות`, s.comments != null && `${s.comments} תגובות`].filter(Boolean).join(' · ')}</small></a>)}</Grid>
        : <div className="bb-empty"><b>עדיין אין דוגמאות תוכן</b><p>אינסטגרם, טיקטוק ופוסטים בפייסבוק דורשים התחברות לסריקה אוטומטית. הדביקו כאן קישורים — המערכת תמשוך טקסט, תמונה וצפיות.</p></div>}
      {gaps.length > 0 && samples.length > 0 && <p className="small muted" style={{ marginTop: 10 }}>חסר: {gaps.join(' · ')}</p>}
      {addForm}
    </Section>
  </div>;
}
