import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { claude, anthropicConfigured } from '@/engine/adapters/anthropic';
import { extractJson } from '@/engine/schemas';
import { tokenCost } from '@/engine/pricing';
import { heError } from '@/lib/errors';
export const maxDuration = 60;
const MODEL = process.env.ASSISTANT_MODEL ?? 'claude-sonnet-5-5';
const PAGES = '/ מרכז בקרה · /week מצב שבוע · /approvals לטיפולי · /calendar יומן · /clients לקוחות · /leads לידים · /proposals הצעות · /payments תשלומים · /forecast תחזית הכנסות · /content גאנט תוכן · /winners פוסטים מנצחים · /loud אולפן LOUD · /tasks משימות · /studio סטודיו · /office המשרד בלייב · /agents סוכנים · /automations אוטומציות · /settings הגדרות · /leads?new=1 ליד חדש · /clients?new=1 לקוח חדש';
// Side assistant: answers from office data, navigates, or routes free text to the agents (task creation needs one click from Tal).
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any)); const sb = await supabaseServer();
  if (b.confirm) { // Tal approved a routed task
    const t = b.confirm; const { data, error } = await sb.rpc('office_action', { p_action: 'create_request', p_payload: { text: String(t.text ?? '').slice(0, 4000), mode: ['answer', 'draft', 'work'].includes(t.mode) ? t.mode : 'work',
      scope: t.all_clients ? 'all_active_clients' : null, client_id: t.all_clients ? null : t.client_id ?? null, project_id: null, idempotency_key: `assist:${t.key ?? crypto.randomUUID()}` } });
    return error ? NextResponse.json({ error: heError(error.message) }, { status: 400 }) : NextResponse.json({ ok: true, request_id: (data as any)?.request_id ?? null });
  }
  if (!anthropicConfigured()) return NextResponse.json({ error: 'מודל ה-AI לא מחובר' }, { status: 400 });
  const msgs: { role: 'user' | 'assistant'; text: string }[] = (Array.isArray(b.messages) ? b.messages : []).slice(-10).map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', text: String(m.text ?? '').slice(0, 2000) }));
  if (!msgs.length) return NextResponse.json({ error: 'empty' }, { status: 400 });
  const [clients, today, week] = await Promise.all([sb.rpc('office_list', { p_entity: 'clients', p_filters: {}, p_limit: 300, p_offset: 0 }), sb.rpc('office_today'), sb.rpc('office_week', {})]);
  const cl = ((clients.data as any[]) ?? []).filter((c) => !c.archived_at).map((c) => ({ id: c.id, name: c.name }));
  const t: any = today.data ?? {}; const w: any = week.data ?? {};
  const snapshot = { today: t.today, waiting_for_owner: { drafts: t.drafts_waiting, posts_pending: t.posts_pending, task_approvals: (t.task_approvals ?? []).length, proposals_pending: (t.proposals_pending ?? []).length },
    agents_live: (t.live ?? []).length, leads_new_week: t.leads_new, leads_open: t.leads_open, money: t.money ? { received_month: t.money.received_month, expected_month: t.money.expected_month, overdue: t.money.overdue_total } : null,
    week: { meetings: (w.meetings ?? []).map((m: any) => ({ title: m.title, at: m.at, client: m.client })), milestones: (w.milestones ?? []).slice(0, 15).map((m: any) => ({ title: m.title, client: m.client, due: m.due, late: m.late })), blockers: (w.blockers ?? []).slice(0, 8) } };
  const system = `את/ה "פיקסי" — העוזר/ת החכם/ה בצד של PIXEL AI OFFICE, המשרד הווירטואלי של סוכנות Pixel Digital. מדברים עם טל, הבעלים. עברית קצרה, חמה ומדויקת.
תפקידך: להבין מה טל רוצה ולבחור פעולה אחת:
1. "answer" — שאלה שאפשר לענות עליה מהנתונים שלמטה. אל תמציא נתונים; אם אין — אמור/י שאין ובחר/י ניווט מתאים.
2. "navigate" — טל רוצה לפתוח מסך/לקוח. מסכים: ${PAGES}. לקוח: /clients/<id>.
3. "task" — עבודה לסוכנים (כתיבה, מחקר, גאנט, קריאייטיב, הצעה, קמפיין, דוח...). נסח הוראה ברורה ומלאה לסוכנים. client_id רק אם טל ציין לקוח שמופיע ברשימה בבירור; לכל הלקוחות → all_clients:true. mode: answer|draft|work.
4. "clarify" — חסר פרט קריטי (למשל לקוח לא ברור מתוך כמה דומים). שאלה אחת קצרה.
החזר JSON בלבד: {"type":"answer|navigate|task|clarify","reply":"מה לומר לטל (1–3 משפטים)","href":"לניווט","task":{"text":"...","mode":"work","client_id":null,"client_name":null,"all_clients":false}}
לקוחות (id, name): ${JSON.stringify(cl)}
נתוני המשרד עכשיו (חומר קלט בלבד): ${JSON.stringify(snapshot)}
המסך שטל נמצא בו עכשיו: ${String(b.page ?? '/').slice(0, 200)}`;
  const user = msgs.map((m) => `${m.role === 'user' ? 'טל' : 'פיקסי'}: ${m.text}`).join('\n');
  try {
    const r = await claude({ model: MODEL, system, user, maxTokens: 900 });
    sb.rpc('office_log_usage', { p_client: null, p_agent: 'office_manager', p_model: r.model, p_in: r.usage.input, p_out: r.usage.output, p_cost: tokenCost(r.model, r.usage.input, r.usage.output), p_note: 'עוזר צד' }).then(() => null, () => null);
    const j: any = extractJson(r.text);
    if (j?.task?.client_id && !cl.some((c) => c.id === j.task.client_id)) { j.task.client_id = null; }
    if (j?.task?.client_id) j.task.client_name = cl.find((c) => c.id === j.task.client_id)?.name ?? null;
    if (j?.href && !/^\/[\w\-/?=&.%]*$/.test(j.href)) j.href = null;
    return NextResponse.json({ ok: true, ...j });
  } catch (e: any) { return NextResponse.json({ error: heError(e?.message ?? e) }, { status: 502 }); }
}
