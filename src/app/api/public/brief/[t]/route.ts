import { NextResponse, type NextRequest, after } from 'next/server';
import { w } from '@/engine/db';
import { brandedEmail, gmailConfigured, gmailSend } from '@/engine/adapters/gmail';
import { summarizeIntake } from '@/engine/intake-summary';
import { intakeProgress } from '@/lib/intake';
export const maxDuration = 60;
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pixel-ai-office-iota.vercel.app';
const ERR = (m: string) => /intake_invalid/.test(m) ? 'הקישור אינו בתוקף' : /bad_file/.test(m) ? 'לא הצלחנו לשמור את הקובץ' : 'לא הצלחנו לשמור, נסו שוב';
// Client intake file — autosave answers, register uploaded files (the file itself goes straight to storage), submit.
export async function POST(req: NextRequest, { params }: { params: Promise<{ t: string }> }) {
  const { t } = await params; if (!/^[0-9a-f]{32,64}$/.test(t)) return NextResponse.json({ error: 'הקישור אינו בתוקף' }, { status: 404 });
  const b = await req.json().catch(() => ({} as any));
  try {
    if (b.op === 'save') return NextResponse.json(await w('office_worker_intake_save', { p_token: t, p_section: String(b.section ?? ''), p_answers: b.answers ?? {} }));
    if (b.op === 'file_add' || b.op === 'file_remove') return NextResponse.json(await w('office_worker_intake_file', { p_token: t, p_op: b.op === 'file_add' ? 'add' : 'remove', p_file: b.file ?? {} }));
    if (b.op === 'submit') {
      const r: any = await w('office_worker_intake_submit', { p_token: t });
      after(async () => {
        const v: any = await w('office_worker_intake_get', { p_token: t }).catch(() => null); if (!v) return;
        const pct = intakeProgress(v.services ?? [], v.data ?? {}, v.files ?? []);
        await summarizeIntake(r.client_id, r.client_name, v.services ?? [], v.data ?? {}, v.files ?? []).catch((e) => console.error('intake summary', String(e).slice(0, 200)));
        if (gmailConfigured()) {
          const text = `${r.client_name} ${r.first ? 'סיים/ה למלא את תיק האפיון' : 'עדכן/ה את תיק האפיון'} (${pct}% מולא, ${(v.files ?? []).length} קבצים).\n\nדף הכנה לשיחה, כל התשובות והחומרים מחכים בתיק הלקוח:\n${SITE}/clients/${r.client_id}?tab=intake`;
          await gmailSend({ to: 'tal.pixeld@gmail.com', subject: `📂 תיק אפיון · ${r.client_name}${r.first ? '' : ' (עדכון)'}`, html: brandedEmail(text), text }).catch(() => null);
        }
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'bad_op' }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: ERR(String(e?.message ?? '')) }, { status: 400 }); }
}
