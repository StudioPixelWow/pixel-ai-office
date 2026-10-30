import 'server-only';
// Client research: site crawl, public social profiles, Claude web search and OpenAI web search.
// Everything collected is public; each fact carries its source URL. Nothing here writes to client systems.

const UA = 'Mozilla/5.0 (compatible; PixelOfficeResearch/1.0; +https://s-pixel.co.il)';
const SOCIAL = [['facebook', /facebook\.com\//i], ['instagram', /instagram\.com\//i], ['linkedin', /linkedin\.com\//i], ['tiktok', /tiktok\.com\//i],
  ['youtube', /youtube\.com\/|youtu\.be\//i], ['x', /(twitter|x)\.com\//i], ['whatsapp', /wa\.me\/|api\.whatsapp\.com/i]] as const;

async function get(url: string, ms = 9000): Promise<{ ok: boolean; status: number; url: string; text: string; type: string }> {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,text/css;q=0.9,*/*;q=0.5', 'accept-language': 'he-IL,he;q=0.9,en;q=0.7' }, redirect: 'follow', signal: ctrl.signal });
    const type = r.headers.get('content-type') ?? ''; const buf = await r.arrayBuffer();
    return { ok: r.ok, status: r.status, url: r.url, type, text: new TextDecoder('utf-8').decode(buf.slice(0, 1_500_000)) };
  } catch { return { ok: false, status: 0, url, text: '', type: '' }; } finally { clearTimeout(t); }
}
const decode = (s: string) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
const meta = (h: string, name: string) => decode((h.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)`, 'i')) ?? h.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, 'i')))?.[1] ?? '').trim();
function textOf(h: string) {
  return decode(h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/section)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
const abs = (href: string, base: string) => { try { return new URL(decode(href), base).toString(); } catch { return null; } };

export async function crawlSite(start: string, maxPages = 10) {
  const first = await get(start.startsWith('http') ? start : `https://${start}`);
  if (!first.ok || !first.text) return { ok: false as const, error: `האתר לא נטען (HTTP ${first.status || 'timeout'})`, url: start };
  const origin = new URL(first.url).origin; const pages: any[] = []; const seen = new Set<string>();
  const socials = new Map<string, string>(); const phones = new Set<string>(); const emails = new Set<string>(); const images = new Set<string>();
  const cssUrls = new Set<string>(); const fontFamilies = new Map<string, number>(); const hex = new Map<string, number>();
  const PRI = /(about|אודות|עלינו|services|שירות|products|מוצר|team|צוות|contact|צור|faq|שאלות|pricing|מחיר|portfolio|תיק|projects|פרויקט|blog|בלוג|reviews|המלצות)/i;
  let queue: string[] = [first.url];
  const scan = (h: string, url: string) => {
    for (const m of h.matchAll(/href=["']([^"'#]+)["']/gi)) {
      const u = abs(m[1], url); if (!u) continue;
      if (u.startsWith('tel:')) phones.add(u.slice(4).replace(/\s/g, '')); else if (u.startsWith('mailto:')) emails.add(u.slice(7).split('?')[0]);
      else { const s = SOCIAL.find(([, re]) => re.test(u)); if (s && !socials.has(s[0]) && !/sharer|share\?|intent\//i.test(u)) socials.set(s[0], u.split('?')[0]);
        else if (u.startsWith(origin) && !/\.(jpg|jpeg|png|webp|gif|svg|pdf|zip|mp4|css|js)(\?|$)/i.test(u) && !/wp-(admin|json|login)|\/feed\/?$|\?/.test(u)) { if (!seen.has(u)) queue.push(u); } }
    }
    for (const m of h.matchAll(/<link[^>]+href=["']([^"']+\.css[^"']*)["']/gi)) { const u = abs(m[1], url); if (u) cssUrls.add(u); }
    for (const m of h.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/gi)) decodeURIComponent(m[1]).split('|').forEach((f) => fontFamilies.set(f.split(':')[0].replace(/\+/g, ' '), (fontFamilies.get(f) ?? 0) + 5));
    const addImg = (raw?: string) => { if (!raw) return; const u = abs(raw.trim().split(/\s+/)[0], url); if (!u || /^data:/i.test(u)) return;
      const path = (() => { try { return new URL(u).pathname.toLowerCase(); } catch { return u.toLowerCase(); } })();
      if (/\.svg$|\.gif$|(^|\/)(tracking|spacer|blank|1x1)[^/]*$|facebook\.com\/tr|google-analytics|doubleclick/.test(path + u) ) return;
      if (/(-|_)(\d{2,3})x(\d{2,3})\.(png|jpe?g|webp)$/.test(path) && Number(path.match(/(\d{2,3})x\d{2,3}\./)?.[1]) < 150) return;
      images.add(u); };
    for (const m of h.matchAll(/<img\b[^>]*>/gi)) { const tag = m[0];
      addImg(tag.match(/\b(?:data-lazy-src|data-src|data-original)=["']([^"']+)["']/i)?.[1] ?? tag.match(/\bsrc=["']([^"']+)["']/i)?.[1]);
      const ss = tag.match(/\b(?:data-srcset|srcset)=["']([^"']+)["']/i)?.[1]; if (ss) addImg(ss.split(',').pop()); }
    for (const m of h.matchAll(/background(?:-image)?\s*:\s*url\((['"]?)([^'")]+)\1\)/gi)) addImg(m[2]);
    for (const m of h.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)) addImg(m[1]);
    for (const m of (h.match(/<style[\s\S]*?<\/style>/gi) ?? []).join(' ').matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) hex.set(m[1].toLowerCase(), (hex.get(m[1].toLowerCase()) ?? 0) + 1);
  };
  while (queue.length && pages.length < maxPages) {
    queue = [...new Set(queue)].filter((u) => !seen.has(u)).sort((a, b) => Number(PRI.test(b)) - Number(PRI.test(a)));
    const u = queue.shift()!; seen.add(u);
    const r = u === first.url ? first : await get(u); if (!r.ok || !/html/i.test(r.type || 'html')) continue;
    scan(r.text, r.url);
    const title = decode(r.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
    const h = [...r.text.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => textOf(m[2])).filter(Boolean).slice(0, 25);
    pages.push({ url: r.url, title, description: meta(r.text, 'description') || meta(r.text, 'og:description'), headings: h, text: textOf(r.text).slice(0, 3500) });
  }
  for (const c of [...cssUrls].slice(0, 3)) { const r = await get(c, 7000); if (!r.ok) continue;
    for (const m of r.text.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) hex.set(m[1].toLowerCase(), (hex.get(m[1].toLowerCase()) ?? 0) + 1);
    for (const m of r.text.matchAll(/font-family:\s*([^;}]+)/gi)) { const f = m[1].split(',')[0].replace(/["']/g, '').trim(); if (f && !/inherit|initial|var\(|sans-serif|serif|monospace|eicons|fontawesome|font awesome|dashicons/i.test(f)) fontFamilies.set(f, (fontFamilies.get(f) ?? 0) + 1); } }
  const isGrey = (x: string) => { const f = x.length === 3 ? x.split('').map((c) => c + c).join('') : x; const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)); return Math.max(r, g, b) - Math.min(r, g, b) < 18; };
  const home = first.text; const logo = [...home.matchAll(/<img[^>]+>/gi)].map((m) => m[0]).find((t) => /logo/i.test(t))?.match(/src=["']([^"']+)/i)?.[1];
  return { ok: true as const, url: first.url, origin, site_name: meta(home, 'og:site_name') || pages[0]?.title, og_image: abs(meta(home, 'og:image'), first.url), logo: logo ? abs(logo, first.url) : null,
    favicon: abs(home.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)/i)?.[1] ?? '/favicon.ico', first.url),
    theme_color: meta(home, 'theme-color') || null, lang: home.match(/<html[^>]+lang=["']([^"']+)/i)?.[1] ?? null,
    colors: [...hex.entries()].filter(([x]) => !isGrey(x)).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([x, n]) => ({ hex: `#${x.length === 3 ? x.split('').map((c) => c + c).join('') : x}`, uses: n })),
    fonts: [...fontFamilies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f]) => f),
    socials: Object.fromEntries(socials), phones: [...phones].slice(0, 5), emails: [...emails].slice(0, 5), images: [...images].slice(0, 40), pages };
}

/** Public profile snapshot from Open Graph tags. Many networks require login — that is reported, never guessed. */
export async function socialScan(socials: Record<string, string>) {
  const out: any[] = [];
  for (const [net, url] of Object.entries(socials)) {
    if (net === 'whatsapp') { out.push({ network: net, url, status: 'link' }); continue; }
    const r = await get(url, 8000);
    const title = meta(r.text, 'og:title'); const desc = meta(r.text, 'og:description') || meta(r.text, 'description');
    const walled = !r.ok || /login|log in|התחבר|sign up/i.test(title) || (!title && !desc);
    const followers = desc.match(/([\d.,]+[KMk]?)\s*(Followers|עוקבים|followers|likes|אהבו)/)?.[1] ?? null;
    out.push({ network: net, url, status: walled ? 'requires_login' : 'public', title: title || null, description: desc ? desc.slice(0, 400) : null, followers_text: followers, image: meta(r.text, 'og:image') || null });
  }
  return out;
}

/** Claude with the server-side web search tool. Returns prose + the URLs it actually cited. */
export async function claudeWebResearch(prompt: string, model = 'claude-opus-5-5') {
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 6000, tools: [{ type: process.env.ANTHROPIC_WEB_SEARCH_TOOL || 'web_search_20250305', name: 'web_search', max_uses: 8 }],
      messages: [{ role: 'user', content: prompt }] }) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) { const e: any = new Error(`claude web search ${r.status}: ${j?.error?.message ?? ''}`); e.status = r.status; e.retryable = r.status === 429 || r.status >= 500; throw e; }
  const blocks: any[] = j.content ?? []; const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const urls = [...new Set(blocks.flatMap((b) => (b.citations ?? []).map((c: any) => c.url)).filter(Boolean))];
  return { text, urls, model: j.model as string, usage: { input: j.usage?.input_tokens ?? 0, output: j.usage?.output_tokens ?? 0, searches: j.usage?.server_tool_use?.web_search_requests ?? 0 } };
}

/** OpenAI Responses API with web search (the API route to ChatGPT-grade research). Picks the newest available model. */
export async function openaiWebResearch(prompt: string) {
  const H = { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' };
  let model = process.env.OPENAI_RESEARCH_MODEL;
  if (!model) {
    const ms = await fetch('https://api.openai.com/v1/models', { headers: H }).then((x) => x.json()).catch(() => ({ data: [] }));
    const ids: string[] = (ms.data ?? []).map((m: any) => m.id);
    model = ['gpt-5.5', 'gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-4.1', 'gpt-4o'].find((m) => ids.includes(m)) ?? ids.find((m) => /^gpt-5/.test(m)) ?? 'gpt-4.1';
  }
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 170_000);
  const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: H, signal: ctrl.signal, body: JSON.stringify({ model, tools: [{ type: 'web_search' }], input: prompt }) }).finally(() => clearTimeout(to));
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) { const e: any = new Error(`openai research ${r.status}: ${j?.error?.message ?? ''}`); e.status = r.status; throw e; }
  const msgs = (j.output ?? []).filter((o: any) => o.type === 'message').flatMap((o: any) => o.content ?? []);
  const text = j.output_text ?? msgs.map((c: any) => c.text ?? '').join('');
  const urls = [...new Set(msgs.flatMap((c: any) => (c.annotations ?? []).map((a: any) => a.url)).filter(Boolean))];
  return { text, urls, model, usage: { input: j.usage?.input_tokens ?? 0, output: j.usage?.output_tokens ?? 0 } };
}

export function researchPrompt(p: { company: string; website?: string; industry?: string; city?: string; socials?: Record<string, string> }) {
  return `אתה חוקר שיווקי בכיר במשרד Pixel Digital. בצע מחקר רשת מקיף על העסק "${p.company}"${p.industry ? ` (תחום: ${p.industry})` : ''}${p.website ? `, אתר: ${p.website}` : ''}.
מצא ופרט, עם קישור מקור לכל פרט:
1. מי העסק: שנות פעילות, מייסדים/צוות בולט, מיקום/סניפים, גודל משוער (סמן כהערכה).
2. שירותים ומוצרים מרכזיים ומחירים אם מפורסמים.
3. מוניטין: ביקורות בגוגל ובאתרים נוספים (דירוג, כמות, נושאים חוזרים חיוביים ושליליים), כתבות ואזכורים בתקשורת.
4. נוכחות דיגיטלית: פרופיל Google Business, פייסבוק, אינסטגרם, לינקדאין, טיקטוק, יוטיוב — קישורים, עוקבים אם גלויים, תדירות ואופי תוכן.${p.socials && Object.keys(p.socials).length ? ` קישורים ידועים: ${Object.values(p.socials).join(', ')}` : ''}
5. 3–6 מתחרים ישירים בישראל: שם, אתר, במה הם חזקים.
6. קהלי יעד סבירים והמסרים שהעסק משדר היום.
7. פערים והזדמנויות שיווקיות ברורות.
כתוב בעברית. הפרד בין עובדה מאומתת (עם מקור) לבין הערכה. אל תמציא נתונים — אם לא נמצא, כתוב "לא נמצא".`;
}

/** Recent posts/reels/videos for voice calibration. Instagram via the official Graph API (Business Discovery) when Meta is
 *  connected; YouTube via its public feed; other networks only if publicly readable. Never scrapes behind a login. */
export async function socialSamples(socials: Record<string, string>, limit = 20) {
  const samples: any[] = []; const notes: string[] = [];
  const ig = socials.instagram?.match(/instagram\.com\/([A-Za-z0-9._]+)/)?.[1];
  if (ig) {
    if (process.env.META_IG_USER_ID && process.env.META_ACCESS_TOKEN) {
      const f = `business_discovery.username(${ig}){username,followers_count,media_count,biography,media.limit(${limit}){caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url}}`;
      const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.META_IG_USER_ID}?fields=${encodeURIComponent(f)}&access_token=${process.env.META_ACCESS_TOKEN}`).then((x) => x.json()).catch(() => ({}));
      const bd = r?.business_discovery;
      if (bd) { for (const m of bd.media?.data ?? []) samples.push({ network: 'instagram', type: m.media_product_type === 'REELS' ? 'reel' : (m.media_type ?? '').toLowerCase(), url: m.permalink, date: m.timestamp,
          text: m.caption ?? '', likes: m.like_count ?? null, comments: m.comments_count ?? null, thumb: m.thumbnail_url ?? (m.media_type === 'IMAGE' ? m.media_url : null) });
        notes.push(`אינסטגרם @${bd.username}: ${bd.followers_count ?? '?'} עוקבים, ${bd.media_count ?? '?'} פוסטים`); }
      else notes.push(`אינסטגרם: Business Discovery לא החזיר נתונים (${r?.error?.message ?? 'חשבון פרטי/לא עסקי'})`);
    } else notes.push('אינסטגרם: דורש חיבור Meta (Business Discovery) — נוצרה משימת השלמה');
  }
  const yt = socials.youtube;
  if (yt) {
    let channelId = yt.match(/channel\/(UC[\w-]{20,})/)?.[1];
    if (!channelId) { const page = await get(yt, 8000); channelId = page.text.match(/"channelId":"(UC[\w-]{20,})"/)?.[1] ?? page.text.match(/channel_id=(UC[\w-]{20,})/)?.[1]; }
    if (channelId) { const feed = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, 8000);
      for (const e of feed.text.split('<entry>').slice(1, limit + 1)) samples.push({ network: 'youtube', type: /shorts/.test(e) ? 'short' : 'video', url: decode(e.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? ''),
        date: e.match(/<published>([^<]+)/)?.[1], text: decode(`${e.match(/<title>([^<]*)/)?.[1] ?? ''}\n${e.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ?? ''}`).slice(0, 1500),
        views: Number(e.match(/views="(\d+)"/)?.[1] ?? 0) || null, thumb: e.match(/<media:thumbnail url="([^"]+)"/)?.[1] ?? null }); }
    else notes.push('יוטיוב: לא אותר מזהה ערוץ');
  }
  for (const net of ['facebook', 'tiktok', 'linkedin'] as const) if (socials[net]) notes.push(`${net}: נדרשת כניסה לקריאת פוסטים — נוצרה משימת השלמה`);
  return { samples: samples.slice(0, limit), notes };
}
