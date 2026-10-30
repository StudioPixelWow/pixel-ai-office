import { get, list } from '@/lib/api';
import { Hero } from '@/components/ui';
import { ActionForm } from '@/components/client';
import { DEPARTMENTS } from '@/agents/roster';
export default async function Studio({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const base = from ? await get<any>('agent_definitions', from) : null; const vs = from ? await list('agent_versions', { agent_id: from }) : [];
  const v: any = vs[0] ?? {};
  return <>
    <Hero title={<>סטודיו <span className="mark">סוכנים</span></>} sub="תאר תפקיד, הגדר כלים, הרשאות ומגבלות. כל שמירה יוצרת גרסה חדשה; סוכן חדש מתחיל במצב ניסיון עד שתפעיל אותו." />
    <div className="card"><ActionForm action="agent_save_version" submit={base ? 'שמור כגרסה חדשה' : 'צור סוכן (מצב ניסיון)'} reset={false}
      extra={base ? { agent_id: base.id } : {}} redirectTo="/agents/{agent_id}"
      fields={[
        { name: 'name', label: 'שם', required: true, defaultValue: base?.name }, { name: 'role_title', label: 'תפקיד', required: true, defaultValue: base?.role_title },
        { name: 'department', label: 'מחלקה', type: 'select', options: Object.entries(DEPARTMENTS), defaultValue: base?.department },
        { name: 'instructions', label: 'הוראות (שפה חופשית)', type: 'textarea', required: true, defaultValue: v.instructions },
        { name: 'preferred_model', label: 'מודל מועדף', type: 'select', options: [['claude-opus-5-5', 'Claude Opus 5.5'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5'], ['claude-haiku-5-5', 'Claude Haiku 5.5']], defaultValue: v.preferred_model ?? 'claude-opus-5-5' },
        { name: 'tools', label: 'כלים (מופרדים בפסיק)', list: true, defaultValue: (v.tools ?? []).join(', '), hint: 'למשל read_records, prepare_message, web_research — הרשאות נאכפות בקוד ולא ע״י ההוראות' },
        { name: 'required_capabilities', label: 'יכולות נדרשות', list: true, defaultValue: (v.required_capabilities ?? ['generate_text']).join(', ') },
        { name: 'spec', label: 'מפרט תפעולי (JSON)', type: 'textarea', json: true, ltr: true, defaultValue: JSON.stringify(v.spec ?? { mission: '', task_types: [], inputs_required: [], procedure: [], output: '', quality_checks: [], done_when: '', handoff: '', limits: '' }, null, 1) },
        { name: 'eval_tasks', label: 'משימות הערכה (JSON)', type: 'textarea', json: true, ltr: true, defaultValue: JSON.stringify(v.eval_tasks ?? [], null, 1) },
        { name: 'change_note', label: 'מה השתנה בגרסה', defaultValue: base ? '' : 'יצירה' },
      ]} /></div>
    <p className="small muted">משוב שלך הופך להנחיה שמורה רק אחרי שמירה כגרסה. זה אינו אימון מחדש של מודל ואינו משנה הרשאות מערכת.</p>
  </>;
}
