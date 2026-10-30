'use client';
import { useState } from 'react';
import { callRpc } from '@/components/client';
import { heError } from '@/lib/errors';
import { useRouter } from 'next/navigation';

export function SetupChecklist({ agents, conns, worker }: { agents: number; conns: any[]; worker: boolean }) {
  const r = useRouter(); const [msg, setMsg] = useState('');
  const ok = (p: string) => conns.some((c) => c.provider === p && ['access_verified', 'action_tested'].includes(c.status));
  const items: [boolean, string, string][] = [
    [agents >= 40, '40 סוכני הפתיחה נטענו', 'seed'], [worker, 'מנוע העבודה (Worker) רשום — CRON_SECRET בשרת', 'worker'], [ok('anthropic'), 'Claude (ANTHROPIC_API_KEY) אומת', '/connections'],
    [ok('openai_api'), 'OpenAI Images API אומת', '/connections'], [ok('whatsapp_cloud'), 'WhatsApp Cloud API רשמי', '/connections'], [ok('kling_api'), 'Kling API', '/connections'],
  ];
  if (items.every((i) => i[0])) return null;
  return <div className="card" style={{ marginBottom: 16 }}><h2>הקמה ראשונית</h2><p className="muted small">אפשר לעבוד על לקוחות, לידים והצעות כבר עכשיו. שלבים שתלויים בחיבור יחכו עד שיחובר.</p>
    <div className="steps">{items.map(([done, label, act]) => <div key={label} className={`step ${done ? 'done' : ''}`}><div className="num">{done ? '✓' : '·'}</div><div className="sp">{label}</div>
      {!done && (act === 'worker' ? <button className="btn y sm" onClick={async () => { const x = await fetch('/api/setup/worker-secret', { method: 'POST' }); const j = await x.json(); setMsg(j.ok ? 'ה-Worker נרשם' : heError(j.error)); r.refresh(); }}>רשום Worker</button> : act === 'seed' ? <button className="btn y sm" onClick={async () => { try { const d = await callRpc('office_seed_agents', {}); setMsg(`נטענו ${d.seeded} סוכנים`); r.refresh(); } catch (e) { setMsg(heError(e)); } }}>טען סוכנים</button>
        : <a className="btn sm" href={act}>לחיבורים</a>)}</div>)}</div>
    <div className="row" style={{ marginTop: 10 }}><button className="btn ghost sm" onClick={async () => { try { await callRpc('office_seed_test_data', {}); setMsg('נוצרה סביבת בדיקה מסומנת [בדיקה]'); r.refresh(); } catch (e) { setMsg(heError(e)); } }}>צור נתוני בדיקה מסומנים</button>
      {msg && <span className="small">{msg}</span>}</div></div>;
}
