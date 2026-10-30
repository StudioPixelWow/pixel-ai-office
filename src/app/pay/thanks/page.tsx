export const metadata = { title: 'תודה · Pixel Digital' };
export default async function Thanks({ searchParams }: { searchParams: Promise<{ cancel?: string }> }) {
  const { cancel } = await searchParams;
  return (
    <main dir="rtl" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#00CFFF,#0077B6)', fontFamily: 'inherit', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '40px 32px', maxWidth: 440, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
        <img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-500.webp" alt="Pixel Digital" style={{ height: 40, marginBottom: 14 }} />
        <div style={{ fontSize: 44 }}>{cancel ? '↩︎' : '✓'}</div>
        <h1 style={{ margin: '12px 0 8px', fontSize: 26 }}>{cancel ? 'התשלום בוטל' : 'התשלום התקבל, תודה!'}</h1>
        <p style={{ color: '#475569', lineHeight: 1.6 }}>{cancel ? 'לא בוצע חיוב. אפשר לחזור לקישור ולנסות שוב בכל עת.' : 'קבלה תישלח אליך בנפרד. צוות Pixel Digital ייצור איתך קשר להמשך.'}</p>
      </div>
    </main>
  );
}
