import { w } from '@/engine/db';
import { verifyPay } from '@/lib/paytoken';
import { GuestJourney } from './journey';
export const dynamic = 'force-dynamic';
export default async function Guest({ params }: { params: Promise<{ t: string }> }) {
  const { t } = await params; const p = verifyPay(t);
  const d: any = p?.k === 'pod' ? await w('office_worker_studio_public', { p_id: p.id }).catch(() => null) : null;
  return <main className="ld-wrap">
    <header className="ld-top"><img className="ld-logo sm" src="/brand/loud-on-dark.svg" alt="LOUD Podcast Studio" /></header>
    {!d ? <section className="ld-card ld-center"><h1>הקישור אינו בתוקף</h1><p className="ld-muted">שלחו לנו הודעה ונשלח קישור חדש.</p></section>
      : <GuestJourney t={t} d={d} />}
    <footer className="ld-foot"><img src="/brand/loud-icon.svg" alt="" /> LOUD Podcast Studio · by Studio Pixel</footer>
  </main>;
}
