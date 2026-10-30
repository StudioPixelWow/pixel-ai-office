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
  proposal_doc: '{"need","services":[],"deliverables":[],"phases":[{"title","detail"}],"timeline","assumptions":[],"items":[{"kind":"setup|retainer|addon|media","title","quantity","unit_price?","description"}],"html?"}',
};

export function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/); const raw = fence ? fence[1] : text;
  const s = raw.indexOf('{'); const e = raw.lastIndexOf('}'); if (s < 0 || e < s) throw new Error('no_json');
  return JSON.parse(raw.slice(s, e + 1));
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
    case 'plan': return `${d.answer ?? d.summary ?? ''}\n\n${(d.tasks ?? []).map((t: any) => `- ${t.title} → ${t.agent_id}`).join('\n')}`;
  }
}
