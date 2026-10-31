import { LayoutDashboard, CalendarRange, CircleCheckBig, CalendarDays, Sparkles, Users, Magnet, RotateCcw, FileSignature, Wallet, TrendingUp, LayoutGrid, Trophy, Mic,
  ListTodo, Palette, Telescope, FolderKanban, ChartLine, MessagesSquare, Building2, Presentation, Bot, Workflow, Library, PlugZap, Coins, Settings, UserPlus, FilePlus2, CalendarPlus, Inbox, BarChart3, type LucideIcon } from 'lucide-react';
// One consistent icon set for the whole office (rounded strokes, Pixel colors come from CSS).
export const ICONS: Record<string, LucideIcon> = {
  home: LayoutDashboard, week: CalendarRange, approvals: CircleCheckBig, calendar: CalendarDays, talk: Sparkles, clients: Users, leads: Magnet, winback: RotateCcw,
  proposals: FileSignature, payments: Wallet, forecast: TrendingUp, content: LayoutGrid, winners: Trophy, loud: Mic, tasks: ListTodo, studio: Palette, research: Telescope,
  planning: FolderKanban, media: ChartLine, conversations: MessagesSquare, office: Building2, room: Presentation, agents: Bot, automations: Workflow, knowledge: Library,
  connections: PlugZap, usage: Coins, settings: Settings, newLead: Magnet, newClient: UserPlus, newProposal: FilePlus2, newMeeting: CalendarPlus, inbox: Inbox, ads: BarChart3,
};
export function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const C = ICONS[name]; if (!C) return null;
  return <C size={size} strokeWidth={1.9} className={className} aria-hidden />;
}
