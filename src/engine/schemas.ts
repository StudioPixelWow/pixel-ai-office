import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';
// Structured output contracts, validated in code before anything is saved or any external step runs.
const msg = z.object({ contact_id: z.string().uuid(), body: z.string().min(2).max(1500), reason: z.string().max(400), kind: z.string().default('followup'),
  attachment_version_ids: z.array(z.string().uuid()).max(5).default([]) });
export const OUTPUT = {
  plan: z.object({ answer: z.string().optional(), summary: z.string().optional(),
    tasks: z.array(z.object({ agent_id: z.string(), title: z.string().max(120), instruction: z.string().max(2000) })).max(8).default([]) }),
  idea: z.object({ directions: z.array(z.object({ title: z.string(), audience: z.string(), message: z.string(), hook: z.string(), visual: z.string(), says: z.string(), cta: z.string(), feasibility: z.string() })).min(1).max(5) }),
  copy: z.object({ headline: z.string().max(140), body: z.string().max(2500), cta: z.string().max(80), variant_headline: z.string().max(140).optional(), channel_notes: z.string().optional() }),
  design: z.object({ format: z.enum(['square', 'story', 'portrait', 'landscape', 'pin']).default('square'), headline: z.string().max(90), sub: z.string().max(160).optional(), cta: z.string().max(40).optional(),
    image_prompt: z.string().max(1500), layout_notes: z.string().optional() }),
  report: z.object({ summary: z.string(), passed: z.boolean().optional(), issues: z.array(z.object({ severity: z.enum(['low', 'medium', 'high']), item: z.string(), fix: z.string() })).default([]),
    sections: z.array(z.object({ title: z.string(), body: z.string() })).default([]), message: msg.optional(), message_body: z.string().optional() }),
  research: z.object({ summary: z.string(), findings: z.array(z.object({ title: z.string(), detail: z.string(), source: z.string().optional(), data_kind: z.enum(['public', 'connected_account', 'estimate', 'provided']).default('estimate') })).max(20) }),
  brief: z.object({ summary: z.string(), missing: z.array(z.string()).default([]), questions: z.array(z.string()).default([]), message: msg.optional() }),
  script: z.object({ title: z.string(), duration_s: z.number().min(3).max(180), aspect: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
    shots: z.array(z.object({ n: z.number(), seconds: z.number(), visual: z.string(), voiceover: z.string().optional(), caption: z.string().optional() })).min(1).max(20) }),
  storyboard: z.object({ shots: z.array(z.object({ n: z.number(), seconds: z.number(), kling_prompt: z.string().max(1500), caption: z.string().optional() })).min(1).max(12), music_note: z.string().optional() }),
  article: z.object({ title: z.string(), slug: z.string().optional(), excerpt: z.string().max(300), body_markdown: z.string().min(200), sources: z.array(z.string()).default([]), faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]) }),
  proposal_doc: z.object({ need: z.string(), services: z.array(z.string()), deliverables: z.array(z.string()), phases: z.array(z.object({ title: z.string(), detail: z.string() })), timeline: z.string(), assumptions: z.array(z.string()),
    items: z.array(z.object({ kind: z.enum(['setup', 'retainer', 'addon', 'media']), title: z.string(), quantity: z.number().optional(), unit_price: z.number().optional(), description: z.string().optional() })).default([]),
    html: z.string().optional() }),
  client_dossier: z.object({ summary: z.string(),
    brand: z.object({ voice: z.string().default(''), tone_words: z.array(z.string()).default([]), values: z.array(z.string()).default([]), differentiators: z.array(z.string()).default([]),
      messages: z.array(z.string()).default([]), colors: z.array(z.object({ hex: z.string(), role: z.string().optional() })).default([]), fonts: z.array(z.string()).default([]), logo_url: z.string().nullable().optional() }).default({} as any),
    business: z.object({ about: z.string().default(''), services: z.array(z.object({ name: z.string(), description: z.string().default('') })).default([]), faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
      locations: z.array(z.string()).default([]), contact: z.object({ phones: z.array(z.string()).default([]), emails: z.array(z.string()).default([]), address: z.string().optional() }).default({} as any) }).default({} as any),
    audiences: z.array(z.object({ name: z.string(), pains: z.array(z.string()).default([]), motivations: z.array(z.string()).default([]), channels: z.array(z.string()).default([]) })).default([]),
    competitors: z.array(z.object({ name: z.string(), url: z.string().optional(), strengths: z.string().default(''), gap: z.string().default('') })).default([]),
    digital_presence: z.array(z.object({ network: z.string(), url: z.string().optional(), status: z.string().default(''), notes: z.string().default(''), recommendation: z.string().default('') })).default([]),
    social_voice: z.object({ style: z.string().default(''), caption_length: z.string().default(''), emoji_use: z.string().default(''), hashtags: z.array(z.string()).default([]),
      hooks: z.array(z.string()).default([]), formats_that_work: z.array(z.string()).default([]), visual_style: z.string().default(''), do: z.array(z.string()).default([]), dont: z.array(z.string()).default([]),
      top_examples: z.array(z.object({ url: z.string(), why: z.string() })).default([]) }).default({} as any),
    reputation: z.object({ summary: z.string().default(''), rating: z.string().optional(), themes_positive: z.array(z.string()).default([]), themes_negative: z.array(z.string()).default([]) }).default({} as any),
    content_library: z.object({ pillars: z.array(z.object({ name: z.string(), description: z.string().default('') })).default([]),
      post_ideas: z.array(z.object({ title: z.string(), format: z.string().default(''), pillar: z.string().default(''), hook: z.string().default('') })).max(40).default([]),
      seo_keywords: z.array(z.string()).default([]), aeo_questions: z.array(z.string()).default([]) }).default({} as any),
    opportunities: z.array(z.string()).default([]), open_questions: z.array(z.string()).default([]), sources: z.array(z.string()).default([]) }),
  content_plan: z.object({ summary: z.string().default(''), posts: z.array(z.object({ date: z.string(), title: z.string(), slot_kind: z.string().default('regular'), marker: z.string().nullable().optional(),
    rtm_id: z.string().nullable().optional(), pillar: z.string().default(''), format: z.string().default('פוסט'), platforms: z.array(z.string()).default([]), idea: z.string().default(''), hook: z.string().default(''),
    post_text: z.string(), hashtags: z.array(z.string()).default([]), cta: z.string().default(''), creative_prompt: z.string().default(''), why: z.string().default(''), time: z.string().optional() })).min(1) }),
} as const;
export type OutputKind = keyof typeof OUTPUT;

export const SHAPE_HINT: Record<OutputKind, string> = {
  plan: '{"answer":"...","tasks":[{"agent_id":"<id מהרשימה>","title":"...","instruction":"..."}]}',
  idea: '{"directions":[{"title","audience","message","hook","visual","says","cta","feasibility"}]} (3 כיוונים)',
  copy: '{"headline","body","cta","variant_headline","channel_notes"}',
  design: '{"format":"square|story|portrait|landscape|pin","headline","sub","cta","image_prompt (באנגלית, בלי טקסט בתמונה)","layout_notes"}',
  report: '{"summary","passed",' + '"issues":[{"severity":"low|medium|high","item","fix"}],"sections":[{"title","body"}],"message_body?"}',
  research: '{"summary","findings":[{"title","detail","source","data_kind":"public|connected_account|estimate|provided"}]}',
  brief: '{"summary","missing":[...],"questions":[...]}',
  script: '{"title","duration_s","aspect":"9:16","shots":[{"n","seconds","visual","voiceover","caption"}]}',
  storyboard: '{"shots":[{"n","seconds","kling_prompt (English)","caption"}],"music_note"}',
  article: '{"title","slug","excerpt","body_markdown","sources":[...],"faq":[{"q","a"}]}',
  client_dossier: '{"summary","brand":{"voice","tone_words":[],"values":[],"differentiators":[],"messages":[],"colors":[{"hex","role"}],"fonts":[],"logo_url"},"business":{"about","services":[{"name","description"}],"faq":[{"q","a"}],"locations":[],"contact":{"phones":[],"emails":[],"address"}},"audiences":[{"name","pains":[],"motivations":[],"channels":[]}],"competitors":[{"name","url","strengths","gap"}],"digital_presence":[{"network","url","status","notes","recommendation"}],"social_voice":{"style","caption_length","emoji_use","hashtags":[],"hooks":[],"formats_that_work":[],"visual_style","do":[],"dont":[],"top_examples":[{"url","why"}]},"reputation":{"summary","rating","themes_positive":[],"themes_negative":[]},"content_library":{"pillars":[{"name","description"}],"post_ideas":[{"title","format","pillar","hook"}] (30),"seo_keywords":[],"aeo_questions":[]},"opportunities":[],"open_questions":[],"sources":[]}',
  content_plan: '{"summary","posts":[{"date":"YYYY-MM-DD מתוך allowed_dates","title":"כותרת קצרה לפוסט","slot_kind":"regular|holiday|rtm","marker":"שם החג/האירוע או null","rtm_id","pillar","format":"רילס|קרוסלה|פוסט תמונה|סטורי","platforms":["facebook","instagram"],"idea":"רעיון בשורה-שתיים","hook":"משפט פתיחה","post_text":"טקסט מלא מוכן לפרסום בשפת הלקוח","hashtags":[],"cta","creative_prompt":"English visual description, no text in image","why":"למה זה מתאים"}]} — פוסט אחד לכל משבצת',
  proposal_doc: '{"need","services":[],"deliverables":[],"phases":[{"title","detail"}],"timeline","assumptions":[],"items":[{"kind":"setup|retainer|addon|media","title","quantity","unit_price?","description"}],"html?"}',
};

export function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/); const raw = fence ? fence[1] : text;
  const s = raw.indexOf('{'); const e = raw.lastIndexOf('}'); if (s < 0) throw new Error('no_json');
  const slice = e > s ? raw.slice(s, e + 1) : raw.slice(s);
  try { return JSON.parse(slice); }
  // Hebrew abbreviations (בע"מ, ת"א) often leave unescaped quotes; long outputs may be cut — repair before giving up.
  catch { return JSON.parse(jsonrepair(e > s ? raw.slice(s) : slice)); }
}

export function toMarkdown(kind: OutputKind, d: any): string {
  switch (kind) {
    case 'idea': return d.directions.map((x: any, i: number) => `### כיוון ${i + 1}: ${x.title}\n- **קהל:** ${x.audience}\n- **מסר:** ${x.message}\n- **הוק:** ${x.hook}\n- **מה רואים:** ${x.visual}\n- **מה אומרים:** ${x.says}\n- **הנעה לפעולה:** ${x.cta}\n- **היתכנות:** ${x.feasibility}`).join('\n\n');
    case 'copy': return `## ${d.headline}\n\n${d.body}\n\n**CTA:** ${d.cta}${d.variant_headline ? `\n\n_וריאציה:_ ${d.variant_headline}` : ''}`;
    case 'design': return `**פורמט:** ${d.format}\n\n## ${d.headline}\n${d.sub ?? ''}\n\n**CTA:** ${d.cta ?? ''}\n\n_פרומפט תמונה:_ ${d.image_prompt}`;
    case 'report': return `${d.summary}\n\n${(d.issues ?? []).map((i: any) => `- [${i.severity}] ${i.item} → ${i.fix}`).join('\n')}\n\n${(d.sections ?? []).map((s: any) => `### ${s.title}\n${s.body}`).join('\n\n')}`;
    case 'research': return `${d.summary}\n\n${d.findings.map((f: any) => `- **${f.title}** — ${f.detail}${f.source ? ` (מקור: ${f.source})` : ''} [${f.data_kind}]`).join('\n')}`;
    case 'brief': return `${d.summary}\n\n**חסר:**\n${d.missing.map((m: string) => `- ${m}`).join('\n')}\n\n**שאלות:**\n${d.questions.map((q: string) => `- ${q}`).join('\n')}`;
    case 'script': return `## ${d.title} (${d.duration_s} שנ׳, ${d.aspect})\n\n${d.shots.map((s: any) => `${s.n}. [${s.seconds}s] ${s.visual}${s.voiceover ? ` — קריינות: ${s.voiceover}` : ''}`).join('\n')}`;
    case 'storyboard': return d.shots.map((s: any) => `${s.n}. [${s.seconds}s] ${s.kling_prompt}`).join('\n');
    case 'article': return `# ${d.title}\n\n${d.body_markdown}\n\n**מקורות:**\n${d.sources.map((s: string) => `- ${s}`).join('\n')}`;
    case 'proposal_doc': return `## הבנת הצורך\n${d.need}\n\n## שירותים\n${d.services.map((s: string) => `- ${s}`).join('\n')}\n\n## תוצרים\n${d.deliverables.map((s: string) => `- ${s}`).join('\n')}\n\n## שלבים\n${d.phases.map((p: any) => `- **${p.title}:** ${p.detail}`).join('\n')}\n\n## לוח זמנים\n${d.timeline}\n\n## הנחות יסוד\n${d.assumptions.map((s: string) => `- ${s}`).join('\n')}`;
    case 'client_dossier': return dossierMarkdown(d);
    case 'content_plan': return `${d.summary}\n\n${d.posts.map((x: any) => `### ${x.date} · ${x.title}${x.marker ? ` · ${x.marker}` : ''}\n_${x.format} · ${(x.platforms ?? []).join(', ')}_\n\n${x.post_text}\n\n${(x.hashtags ?? []).join(' ')}`).join('\n\n')}`;
    case 'plan': return `${d.answer ?? d.summary ?? ''}\n\n${(d.tasks ?? []).map((t: any) => `- ${t.title} → ${t.agent_id}`).join('\n')}`;
  }
}

export function dossierMarkdown(d: any): string {
  const L = (a: any[] = []) => a.map((x) => `- ${x}`).join('\n');
  return [`# תיק לקוח\n${d.summary}`,
    `## מותג\n**טון:** ${d.brand?.voice ?? ''}\n**מילות טון:** ${(d.brand?.tone_words ?? []).join(', ')}\n**בידול:**\n${L(d.brand?.differentiators)}\n**מסרים:**\n${L(d.brand?.messages)}\n**צבעים:** ${(d.brand?.colors ?? []).map((c: any) => `${c.hex}${c.role ? ` (${c.role})` : ''}`).join(', ')}\n**פונטים:** ${(d.brand?.fonts ?? []).join(', ')}`,
    `## העסק\n${d.business?.about ?? ''}\n${(d.business?.services ?? []).map((s: any) => `- **${s.name}** — ${s.description}`).join('\n')}`,
    `## קהלי יעד\n${(d.audiences ?? []).map((a: any) => `- **${a.name}** · כאבים: ${a.pains.join(', ')} · מניעים: ${a.motivations.join(', ')}`).join('\n')}`,
    `## מתחרים\n${(d.competitors ?? []).map((c: any) => `- **${c.name}** ${c.url ?? ''} — ${c.strengths} · הפער: ${c.gap}`).join('\n')}`,
    `## נוכחות דיגיטלית\n${(d.digital_presence ?? []).map((p: any) => `- **${p.network}** ${p.url ?? ''} — ${p.status}. ${p.notes} → ${p.recommendation}`).join('\n')}`,
    `## שפת הרשתות\n**סגנון:** ${d.social_voice?.style ?? ''}\n**אורך טקסט:** ${d.social_voice?.caption_length ?? ''} · **אימוג׳י:** ${d.social_voice?.emoji_use ?? ''}\n**האשטגים:** ${(d.social_voice?.hashtags ?? []).join(' ')}\n**הוקים:**\n${L(d.social_voice?.hooks)}\n**פורמטים שעובדים:** ${(d.social_voice?.formats_that_work ?? []).join(', ')}\n**ויזואל:** ${d.social_voice?.visual_style ?? ''}\n**כן:**\n${L(d.social_voice?.do)}\n**לא:**\n${L(d.social_voice?.dont)}\n**דוגמאות מובילות:**\n${(d.social_voice?.top_examples ?? []).map((x: any) => `- ${x.url} — ${x.why}`).join('\n')}`,
    `## מוניטין\n${d.reputation?.summary ?? ''}`,
    `## ספריית תוכן\n### עמודי תוכן\n${(d.content_library?.pillars ?? []).map((p: any) => `- **${p.name}** — ${p.description}`).join('\n')}\n### רעיונות לפוסטים\n${(d.content_library?.post_ideas ?? []).map((p: any, i: number) => `${i + 1}. ${p.title} (${p.format}${p.pillar ? ` · ${p.pillar}` : ''}) — ${p.hook}`).join('\n')}\n### ביטויי SEO\n${(d.content_library?.seo_keywords ?? []).join(' · ')}\n### שאלות למנועי AI\n${L(d.content_library?.aeo_questions)}`,
    `## הזדמנויות\n${L(d.opportunities)}`, `## שאלות פתוחות ללקוח\n${L(d.open_questions)}`, `## מקורות\n${L(d.sources)}`].join('\n\n');
}
