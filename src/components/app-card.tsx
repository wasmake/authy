import { ArrowUpRight, Clock, Star } from 'lucide-react';

import { AppIcon } from '@/components/app-icon';

export type AppView = {
  id: string;
  name: string;
  description?: string | null;
  launchUrl?: string | null;
  type: string;
  favorites?: unknown[];
  usage?: { usedAt: string }[];
};

export function AppCard({
  app,
  requestAccess,
  compact = false,
}: {
  app: AppView;
  requestAccess?: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <article
      className={`card group flex flex-col transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg ${compact ? 'p-4' : 'p-5'}`}
    >
      <div className="flex items-start justify-between">
        <AppIcon name={app.name} />
        {app.favorites && (
          <Star
            size={17}
            className={app.favorites.length ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
          />
        )}
      </div>
      <h2 className="mt-4 truncate font-semibold" title={app.name}>
        {app.name}
      </h2>
      {!compact && (
        <p className="mt-1 line-clamp-2 min-h-[40px] text-sm text-slate-500">
          {app.description ?? `${app.type} application`}
        </p>
      )}
      {app.usage?.[0] && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
          <Clock size={12} />
          {new Date(app.usage[0].usedAt).toLocaleDateString()}
        </p>
      )}
      {requestAccess ? (
        <button className="button-secondary mt-4 w-full" onClick={() => requestAccess(app.id)}>
          Request access
        </button>
      ) : (
        <a className="button mt-4 w-full gap-1.5" href={`/api/v1/applications/${app.id}/launch`}>
          Open <ArrowUpRight size={15} />
        </a>
      )}
    </article>
  );
}
