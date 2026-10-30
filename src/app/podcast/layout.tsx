export const metadata = { title: 'LOUD Podcast Studio', robots: { index: false }, icons: { icon: '/brand/loud-icon.svg' } };
export default function L({ children }: { children: React.ReactNode }) {
  return <><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;800;900&display=swap" rel="stylesheet" /><div className="ld">{children}</div></>;
}
