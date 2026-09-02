import { Box } from 'lucide-react';
import { FaGithub, FaSalesforce, FaSlack } from 'react-icons/fa';
import { SiGrafana, SiNotion } from 'react-icons/si';

const icons = [
  { matches: ['github'], icon: FaGithub, color: '#181717' },
  { matches: ['grafana'], icon: SiGrafana, color: '#F46800' },
  { matches: ['notion'], icon: SiNotion, color: '#000000' },
  { matches: ['slack'], icon: FaSlack, color: '#4A154B' },
  { matches: ['salesforce'], icon: FaSalesforce, color: '#00A1E0' },
];

export function AppIcon({ name, compact = false }: { name: string; compact?: boolean }) {
  const match = icons.find((candidate) =>
    candidate.matches.some((value) => name.toLowerCase().includes(value)),
  );
  const Icon = match?.icon ?? Box;
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl border border-border bg-white shadow-sm dark:bg-slate-100 ${compact ? 'h-9 w-9' : 'h-12 w-12'}`}
    >
      <Icon size={compact ? 18 : 24} color={match?.color ?? '#6D5CE7'} aria-hidden="true" />
    </span>
  );
}
