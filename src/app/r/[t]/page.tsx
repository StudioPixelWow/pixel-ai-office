import type { Metadata } from 'next';
import { supabaseAnon } from '@/lib/supabase/anon';
import { ReferralForm } from './form';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'המלצה · Pixel Digital', robots: { index: false, follow: false } };
// Public referral landing: a happy client shares this link; the friend leaves details → a lead with source "referral".
export default async function Referral({ params }: { params: Promise<{ t: string }> }) {
  const { t } = await params; const { data } = await supabaseAnon().rpc('office_public_referral_info', { p_token: t });
  const from = (data as any)?.from as string | undefined;
  return <main className="ref">
    <img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-500.webp" alt="Pixel Digital" className="ref-logo" />
    {!from ? <><h1>הקישור אינו בתוקף</h1><p>לפרטים: 052-448-8187 · office@s-pixel.co.il</p></> : <>
      <span className="ref-tag">הגעתם בהמלצה של {from}</span>
      <h1>שיווק שמביא <span className="mark">תוצאות</span>, עם צוות שמלווה באמת</h1>
      <p>אסטרטגיה, קמפיינים, סושיאל, אתרים ונראות במנועי AI. השאירו פרטים ונחזור אליכם לשיחת היכרות קצרה, בלי התחייבות.</p>
      <ReferralForm token={t} />
    </>}
  </main>;
}
