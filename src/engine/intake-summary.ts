import 'server-only';
import { w } from '@/engine/db';
import { anthropicConfigured, claude } from '@/engine/adapters/anthropic';
import { intakeText, type IntakeFile } from '@/lib/intake';
// AI prep for the scoping call: what we learned + what is still missing. Internal only; stored on the intake.
export async function summarizeIntake(clientId: string, clientName: string, services: string[], data: Record<string, any>, files: IntakeFile[]) {
  if (!anthropicConfigured()) return null;
  const body = intakeText(services, data, files);
  if (!body.trim()) return null;
  const r = await claude({ model: 'claude-sonnet-5-5', maxTokens: 2200,
    system: 'את/ה אסטרטג/ית שיווק בכיר/ה בסוכנות דיגיטל ישראלית. כתוב/י בעברית, תמציתי ומעשי, בלי הקדמות.',
    user: `לקוח חדש בשם "${clientName}" מילא תיק אפיון לפני שיחת אפיון. השירותים שנרכשו: ${services.join(', ') || 'לא צוין'}.\n\nהתשובות:\n${body}\n\nהכן דף הכנה לשיחה, בפורמט הזה בדיוק:\n## תמונת מצב\n(3-4 שורות)\n## מה למדנו\n(נקודות קצרות: העסק, הקהל, הבידול, המטרות, המותג)\n## מה חסר או לא ברור\n(5-10 שאלות ממוקדות לשאול בשיחה)\n## כיווני פעולה ראשוניים\n(3-5 נקודות)` });
  await w('office_worker_intake_summary', { p_client: clientId, p_summary: r.text }).catch(() => null);
  return r.text;
}
