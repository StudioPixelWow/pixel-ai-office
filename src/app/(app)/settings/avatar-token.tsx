'use client';
import { useState } from 'react';
import { callRpc } from '@/components/client';
export function AvatarToken() {
  const [t, setT] = useState<string | null>(null);
  return <><p className="small muted">טוקן חד-פעמי ל-30 דקות לייבוא תמונות הדמויות מלשונית ההפקה. מתיר רק כתיבת תמונת דמות ציבורית.</p>
    <button className="btn" onClick={async () => setT((await callRpc('office_create_import_token', { p_purpose: 'avatars' })).token)}>צור טוקן ייבוא</button>
    {t && <p className="small" dir="ltr" style={{ wordBreak: 'break-all' }} data-avatar-token={t}>{t}</p>}</>;
}
