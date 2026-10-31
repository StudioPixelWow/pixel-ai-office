import 'server-only';
import sharp from 'sharp';
import { w } from './db';
import { extractJson } from './schemas';
// Logo pass: find each client's own logo on their site (header/JSON-LD/site-logo/icons, plus social og:image as fallback),
// let Claude vision pick the real brand logo (not partners/clients walls), rasterize to a clean trimmed PNG and store it as a blob.
// SVGs are rasterized on purpose: an uploaded SVG served from our origin could carry script.

// our own agency mark (Studio Pixel / Pixel Digital credit in client footers) is never a client's logo
const OURS = /s-pixel|studio-?pixel|pixel-?digital|סטודיו[\s-]?פיקסל|פיקסל[\s-]?דיגיטל/i;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const VISION = process.env.ANTHROPIC_VISION_MODEL_LOGO || 'claude-sonnet-5-5';
const dec = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const abs = (h: string, base: string) => { try { return new URL(dec(h.trim()), base).toString(); } catch { return null; } };

async function fetchT(url: string, ms = 10000) {
  try { const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*;q=0.8', 'accept-language': 'he-IL,he;q=0.9,en;q=0.7' }, redirect: 'follow', signal: AbortSignal.timeout(ms) });
    return { ok: r.ok, url: r.url, text: r.ok ? (await r.text()).slice(0, 1_500_000) : '' }; } catch { return { ok: false, url, text: '' }; }
}
async function fetchB(url: string) {
  try { const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'image/*,*/*;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null; const b = Buffer.from(await r.arrayBuffer()); return b.length > 40 && b.length < 4_000_000 ? b : null; } catch { return null; }
}
const srcOf = (tag: string, base: string) => {
  const ss = tag.match(/\s(?:data-srcset|srcset)=["']([^"']+)/i)?.[1];
  if (ss) { const best = ss.split(',').map((x) => x.trim().split(/\s+/)).sort((a, b) => parseFloat(b[1] ?? '1') - parseFloat(a[1] ?? '1'))[0]?.[0]; if (best) return abs(best, base); }
  const s = tag.match(/\s(?:data-lazy-src|data-src|src)=["']([^"']+)/i)?.[1]; return s && !s.startsWith('data:') ? abs(s, base) : null;
};

export function logoCandidates(html: string, base: string): { url?: string; svg?: string; why: string }[] {
  const out: { url?: string; svg?: string; why: string }[] = []; const seen = new Set<string>();
  const add = (u: string | null | undefined, why: string) => { if (u && /^https?:/.test(u) && !OURS.test(u) && !seen.has(u)) { seen.add(u); out.push({ url: u, why }); } };
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const l of m[1].matchAll(/"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"([^"]+)"/g)) add(abs(l[1].replace(/\\\//g, '/'), base), 'json-ld');
  }
  const headEnd = Math.max(html.search(/<\/header>/i), Math.floor(html.length * 0.25));
  const WALL = /(?:לקוחות|שותפים|clients|partners|logos?-?(?:carousel|slider|wall)|עבדנו עם|ממליצים|trusted by|swiper|marquee)/i;
  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0]; const at = m.index ?? 0; const ctx = html.slice(Math.max(0, at - 600), at);
    const isLogo = /logo|site-?brand|navbar-brand|custom-logo/i.test(tag) || /class=["'][^"']*(?:logo|site-brand|navbar-brand|header__brand)[^"']*["'][^<]*$/i.test(ctx.slice(-300));
    if (!isLogo || OURS.test(tag)) continue; if (at > headEnd && WALL.test(ctx.replace(/<[^>]+>/g, ' ').slice(-300))) continue;
    // footers carry "site by" agency credits (incl. ours) — only use body/footer logos when the header has none
    if (at > headEnd && out.some((x) => x.why === 'header-img' || x.why === 'json-ld')) continue;
    if (/<footer[\s>]/i.test(html.slice(0, at)) && /(?:בניית אתרים|עיצוב ובניית|נבנה ע|powered by|designed by|developed by|site by|קרדיט)/i.test(html.slice(Math.max(0, at - 1500), at + 400).replace(/<[^>]+>/g, ' '))) continue;
    add(srcOf(tag, base), at <= headEnd ? 'header-img' : 'img');
    if (out.length > 8) break;
  }
  // inline svg logo in the header
  const hdr = html.slice(0, headEnd + 2000);
  const sv = hdr.match(/<(?:a|div|span)[^>]+(?:class|id)=["'][^"']*logo[^"']*["'][^>]*>\s*(?:<a[^>]*>\s*)?(<svg[\s\S]*?<\/svg>)/i)?.[1];
  if (sv && sv.length < 200_000 && !OURS.test(sv)) out.push({ svg: sv, why: 'inline-svg' });
  for (const m of html.matchAll(/<link[^>]+rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]*>/gi)) { const h = m[0].match(/href=["']([^"']+)/i)?.[1]; if (h && !/\.ico(\?|$)/i.test(h)) add(abs(h, base), 'icon'); }
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1] ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1];
  add(og ? abs(og, base) : null, 'og:image');
  return out.slice(0, 12);
}

async function toPng(buf: Buffer, max = 600) {
  const img = sharp(buf, { density: 300, failOn: 'none' });
  let p = await img.png().toBuffer();
  try { p = await sharp(p).trim({ threshold: 8 }).toBuffer(); } catch { /* nothing to trim */ }
  return sharp(p).resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
}
// light logo on transparency → needs a dark tile
async function bgFor(png: Buffer): Promise<'light' | 'dark'> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0, lum = 0, transparent = 0; const step = info.channels * 7;
  for (let i = 0; i < data.length; i += step) { const a = data[i + 3]; if (a < 40) { transparent++; continue; } n++; lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255; }
  return n && transparent > n * 0.15 && lum / n > 0.82 ? 'dark' : 'light';
}

async function pick(company: string, imgs: { png: Buffer; why: string }[]) {
  if (!process.env.ANTHROPIC_API_KEY) return { pick: imgs.findIndex((x) => x.why !== 'og:image' && x.why !== 'icon'), reason: 'no vision' };
  const content: any[] = [];
  for (const [k, x] of imgs.entries()) {
    // show every candidate on a mid-grey tile so white and black logos are both visible
    const tile = await sharp({ create: { width: 640, height: 640, channels: 4, background: { r: 150, g: 150, b: 150, alpha: 1 } } }).composite([{ input: x.png, gravity: 'center' }]).jpeg({ quality: 80 }).toBuffer();
    content.push({ type: 'text', text: `תמונה ${k} (מקור: ${x.why}):` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: tile.toString('base64') } });
  }
  content.push({ type: 'text', text: `אלה מועמדים ללוגו של העסק "${company}" שנאספו מהאתר והרשתות שלו (רקע אפור נוסף לתצוגה בלבד). בחר את הלוגו הראשי של העסק עצמו: עדיף לוגו מלא עם שם על פני אייקון בלבד, ועדיף גרסה צבעונית/כהה על פני לבנה אם שתיהן קיימות. פסול: הלוגו של "סטודיו פיקסל" / "Studio Pixel" / "Pixel Digital" (זו סוכנות הפרסום שבנתה את האתר, לא העסק), לוגו של לקוח/שותף/ספק אחר, תמונת אווירה/צילום, באנר, אייקון גנרי, ותמונה שבה הטקסט מוצג הפוך/במראה או עם תווים שבורים (תקלת המרה). אם יש גם גרסה תקינה של אותו לוגו, בחר בה. אם אף אחד אינו הלוגו של העסק, pick=null. החזר JSON בלבד: {"pick": מספר או null, "reason": "קצר"}` });
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: VISION, max_tokens: 300, messages: [{ role: 'user', content }] }) });
  const j: any = await r.json(); if (!r.ok) throw new Error(`vision ${r.status} ${j?.error?.message ?? ''}`.slice(0, 160));
  const o: any = extractJson((j.content ?? []).map((c: any) => c.text ?? '').join(''));
  return { pick: o?.pick === null || o?.pick === undefined ? -1 : Number(o.pick), reason: String(o?.reason ?? '').slice(0, 200) };
}

export async function findLogo(c: { name: string; website?: string | null; other_sites?: any; socials?: Record<string, string> | null; known?: (string | null)[] }) {
  const cands: { url?: string; svg?: string; why: string }[] = [];
  const sites = [c.website, ...(Array.isArray(c.other_sites) ? c.other_sites : [])].filter((x): x is string => !!x).slice(0, 2);
  for (const s of sites) { const h = await fetchT(s.startsWith('http') ? s : `https://${s}`); if (h.text) cands.push(...logoCandidates(h.text, h.url)); }
  for (const k of c.known ?? []) if (k && /^https?:\/\//.test(k) && !cands.some((x) => x.url === k)) cands.push({ url: k, why: 'previous' });
  if (cands.filter((x) => x.why !== 'og:image').length < 2) for (const net of ['facebook', 'instagram'] as const) {
    const u = c.socials?.[net]; if (!u) continue; const h = await fetchT(u, 8000);
    const og = h.text.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1]; if (og) cands.push({ url: dec(og), why: `${net} profile` });
  }
  const imgs: { png: Buffer; why: string; src: string }[] = [];
  for (const x of cands) {
    if (imgs.length >= 8) break;
    try {
      const raw = x.svg ? Buffer.from(x.svg.includes('xmlns') ? x.svg : x.svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')) : await fetchB(x.url!);
      if (!raw) continue;
      // SVG with live Hebrew <text> renders mirrored on the server (no bidi shaping) — skip it, a raster/outlined version is safer
      const head = raw.subarray(0, 400_000).toString('utf8'); if (/<svg[\s>]/i.test(head) && /<text[\s>][\s\S]*?[\u0590-\u05FF]/.test(head)) continue;
      const png = await toPng(raw); const meta = await sharp(png).metadata();
      if ((meta.width ?? 0) < 24 || (meta.height ?? 0) < 12) continue;
      imgs.push({ png, why: x.why, src: x.url ?? 'inline-svg' });
    } catch { /* unreadable image */ }
  }
  if (!imgs.length) return { ok: false as const, note: sites.length ? 'לא נמצאו קבצי לוגו קריאים באתר' : 'אין אתר' + (c.socials && Object.keys(c.socials).length ? ' והרשתות לא החזירו תמונה' : '') };
  const p = await pick(c.name, imgs);
  if (p.pick < 0 || p.pick >= imgs.length) return { ok: false as const, note: `לא זוהה לוגו של העסק (${p.reason})` };
  const best = imgs[p.pick];
  return { ok: true as const, png: best.png, bg: await bgFor(best.png), src: best.src, note: p.reason };
}

export async function logoTick(limit = 3) {
  const q: any[] = await w('office_worker_logo_queue', { p_limit: limit });
  const done: any[] = [];
  for (const c of q) {
    try {
      const r = await findLogo(c);
      if (r.ok) await w('office_worker_logo_set', { p_client: c.id, p_mime: 'image/png', p_b64: r.png.toString('base64'), p_bg: r.bg, p_src: r.src, p_note: r.note });
      else await w('office_worker_logo_set', { p_client: c.id, p_mime: null, p_b64: null, p_bg: null, p_src: null, p_note: r.note });
      done.push({ name: c.name, ok: r.ok, note: r.note });
    } catch (e: any) { done.push({ name: c.name, ok: false, err: String(e?.message ?? e).slice(0, 120) }); }
  }
  return done;
}
