import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';

import { db } from '@/lib/db';
import { getAuth } from '@/modules/auth/server';

export const config = { api: { bodyParser: false } };
export default async function authHandler(
  req: Parameters<ReturnType<typeof toNodeHandler>>[0],
  res: Parameters<ReturnType<typeof toNodeHandler>>[1],
) {
  const auth = await getAuth();
  if (req.url?.startsWith('/api/auth/oauth2/authorize')) {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (session) {
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { mustChangePassword: true },
      });
      if (user?.mustChangePassword) {
        const continuation = encodeURIComponent(req.url);
        res.statusCode = 302;
        res.setHeader('Location', `/change-password?continue=${continuation}`);
        res.end();
        return;
      }
    }
  }
  return toNodeHandler(auth)(req, res);
}
