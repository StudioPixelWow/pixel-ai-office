import { payContext } from '@/lib/pay-context';
import { growIsSandbox } from '@/engine/adapters/grow';
import { PayClient } from './pay-client';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'תשלום מאובטח · Pixel Digital', robots: { index: false } };
const money = (n: number) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(n);
export default async function PayPage({ params }: { params: Promise<{ t: string }> }) {
  const { t } = await params; const c = await payContext(t); const loud = /^LOUD/.test(c?.title ?? '');
  return <main className={`pay${loud ? ' pay-loud' : ''}`} dir="rtl">
    <div className="pay-card">
      <div className="pay-brand">{loud ? <img src="/brand/loud-on-dark.svg" alt="LOUD Podcast Studio" style={{ height: 64 }} /> : <img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-500.webp" alt="Pixel Digital" />}</div>
      {!c ? <><h1>הקישור אינו בתוקף</h1><p className="pay-sub">ייתכן שפג תוקפו. אפשר לפנות אלינו ונשלח קישור חדש.</p></>
        : c.closed ? <><h1>התשלום כבר הוסדר ✓</h1><p className="pay-sub">תודה! אין צורך בפעולה נוספת.</p></>
        : <>
          <small className="pay-kicker">תשלום מאובטח</small>
          <h1>{c.client}</h1>
          <p className="pay-sub">{c.description}</p>
          <div className="pay-amount"><span>לתשלום</span><b>{c.amount == null ? '—' : money(c.amount)}</b></div>
          {growIsSandbox() && <div className="pay-test">סביבת בדיקה של Grow — אין חיוב אמיתי</div>}
          <PayClient t={t} name={c.name} phone={c.phone} email={c.email} disabled={c.amount == null} returnUrl={c.returnUrl} />
        </>}
      <p className="pay-foot">התשלום מתבצע בסליקה המאובטחת של Grow (משולם). פרטי הכרטיס אינם עוברים דרכנו.</p>
    </div>
  </main>;
}
