import { toNodeHandler } from 'better-auth/node';

import { getAuth } from '@/modules/auth/server';

export const config = { api: { bodyParser: false } };
export default async function authHandler(
  req: Parameters<ReturnType<typeof toNodeHandler>>[0],
  res: Parameters<ReturnType<typeof toNodeHandler>>[1],
) {
  const auth = await getAuth();
  return toNodeHandler(auth)(req, res);
}
