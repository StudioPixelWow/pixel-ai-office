import Page from '../../../proposals/[id]/page';
import { RouteSheet } from '@/components/route-sheet';
export default function Intercepted(props: { params: Promise<{ id: string }>; searchParams: Promise<any> }) {
  return <RouteSheet><Page {...(props as any)} /></RouteSheet>;
}
