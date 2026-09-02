import { ArrowUpRight, Box, Clock, Star } from 'lucide-react';

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
}: {
  app: AppView;
  requestAccess?: (id: string) => void;
}) {
  return (
    <article className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet-400 text-white">
          <Box />
        </span>
        {app.favorites && (
          <Star
            size={18}
            className={app.favorites.length ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}
          />
        )}
      </div>
      <h2 className="mt-5 font-semibold">{app.name}</h2>
      <p className="mt-1 min-h-[40px] text-sm text-slate-500">
        {app.description ?? `${app.type} application`}
      </p>
      {app.usage?.[0] && (
        <p className="mt-3 flex items-center gap-1 text-xs text-slate-400">
          <Clock size={13} />
          Recently used
        </p>
      )}
      {requestAccess ? (
        <button className="button-secondary mt-4 w-full" onClick={() => requestAccess(app.id)}>
          Request access
        </button>
      ) : (
        <a className="button mt-4 w-full gap-2" href={`/api/v1/applications/${app.id}/launch`}>
          Launch <ArrowUpRight size={16} />
        </a>
      )}
    </article>
  );
}
