import { z } from 'zod';

import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';
import { createCredential } from '@/modules/security/credentials';

const schema = z.object({
  name: z.string().min(2).max(80),
  scopes: z.array(z.string().min(1)).max(30),
  expiresAt: z.coerce.date().optional(),
});
export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET', 'POST'])) return;
  const context = await requireContext(req);
  requireAdmin(context);
  if (req.method === 'GET') {
    const keys = await db.apiKey.findMany({
      where: { organizationId: context.organizationId },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        status: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    res.json({ data: keys });
    return;
  }
  const input = parseBody(schema, req);
  const credential = createCredential();
  const key = await db.apiKey.create({
    data: {
      ...input,
      organizationId: context.organizationId,
      prefix: credential.prefix,
      secretHash: credential.secretHash,
    },
  });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'api_key.created',
    targetType: 'apiKey',
    targetId: key.id,
  });
  res.status(201).json({
    data: {
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      secret: credential.secret,
      scopes: key.scopes,
    },
  });
});
