import type { Metadata } from 'next';
import { supabaseAnon } from '@/lib/supabase/anon';
import { ProposalDoc } from '@/components/proposal-doc';
import { SignPanel } from './sign-panel';
import { growConfigured } from '@/engine/adapters/grow';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'הצעת מחיר · Studio Pixel', robots: { index: false, follow: false } };
// Public client view of ONE approved proposal (token-gated). The client can read, sign and — if enabled — pay.
export default async function PublicProposal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data, error } = await supabaseAnon().rpc('office_public_proposal', { p_token: token });
  if (error || !data) return <main className="pub-msg"><img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-500.webp" alt="Pixel Digital" style={{ height: 44 }} />
    <h1>הקישור אינו בתוקף</h1><p>ייתכן שפג תוקפו או שהוחלף בקישור חדש. לפרטים: 052-448-8187 · office@s-pixel.co.il</p></main>;
  const d: any = data;
  const panel = <SignPanel token={token} signed={d.signed} signerName={d.signer_name} signedAt={d.signed_at} canPay={growConfigured()} paymentUrl={d.payment_link_url} />;
  return <main className="pub"><ProposalDoc data={{ title: d.title, number: d.number, created_at: d.created_at, content: d.content, price: d.price ?? {}, totals: d.totals ?? {}, items: d.items ?? [] }}
    signature={d.signed ? <span><b>{d.signer_name}</b> · נחתם דיגיטלית {new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' }).format(new Date(d.signed_at))}</span> : undefined} />
    <div className="pub-panel noprint">{panel}</div></main>;
}
