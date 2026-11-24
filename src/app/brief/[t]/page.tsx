import { w } from '@/engine/db';
import { Brief } from './brief';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'תיק אפיון · Pixel Digital', robots: { index: false, follow: false } };

// Personal client intake file — reached only by its secret link.
export default async function BriefPage({ params }: { params: Promise<{ t: string }> }) {
  const { t } = await params;
  const v: any = /^[0-9a-f]{32,64}$/.test(t) ? await w('office_worker_intake_get', { p_token: t }).catch(() => null) : null;
  if (!v) return <main className="bf bf-off" dir="rtl"><div className="bf-offcard">
    <img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-500.webp" alt="Pixel Digital" />
    <h1>הקישור אינו בתוקף</h1><p>ייתכן שהוחלף בקישור חדש. אפשר לפנות אלינו ונשלח קישור עדכני.</p></div></main>;
  return <Brief t={t} v={v} supa={{ url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' }} />;
}
