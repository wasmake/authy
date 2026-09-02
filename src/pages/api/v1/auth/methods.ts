import { z } from 'zod';

import { apiHandler, method } from '@/lib/api';
import { db } from '@/lib/db';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET'])) return;
  const email = z.string().email().parse(req.query.email);
  const membership = await db.membership.findFirst({
    where: { user: { email: { equals: email, mode: 'insensitive' } } },
    select: {
      organization: {
        select: {
          passwordLoginEnabled: true,
          authProviders: {
            where: { enabled: true },
            select: { type: true, displayName: true },
          },
        },
      },
    },
  });
  const provider = membership?.organization.authProviders[0];
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json({
    data: {
      passwordEnabled: membership?.organization.passwordLoginEnabled ?? true,
      provider: provider
        ? {
            ...provider,
            authProvider:
              provider.type === 'ACTIVE_DIRECTORY' ? 'microsoft' : provider.type.toLowerCase(),
          }
        : null,
    },
  });
});
