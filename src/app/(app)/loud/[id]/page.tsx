import { headers } from 'next/headers';
import { rpc } from '@/lib/api';
import { guestUrl } from '@/lib/loud';
import { BookingView } from './booking';
export const dynamic = 'force-dynamic';
export default async function Booking({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [b, h] = await Promise.all([rpc<any>('office_studio_booking', { p_id: id }).catch(() => null), headers()]);
  if (!b) return <div className="card">ההזמנה לא נמצאה או שאין לך הרשאה.</div>;
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  return <BookingView b={b} link={guestUrl(origin, b.id)} />;
}
