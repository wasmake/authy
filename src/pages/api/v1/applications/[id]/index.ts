import { z } from 'zod';

import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';

const updateSchema = z.object({ isPublished: z.boolean() }).strict();

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['PATCH', 'DELETE'])) return;
  const context = await requireContext(req);
  requireAdmin(context);
  const id = String(req.query.id);
  const application = await db.application.findFirst({
    where: { id, organizationId: context.organizationId },
  });
  if (!application) throw Object.assign(new Error('Application not found'), { statusCode: 404 });

  if (req.method === 'DELETE') {
    await db.application.delete({ where: { id } });
    await audit({
      organizationId: context.organizationId,
      actorId: context.userId,
      action: 'application.deleted',
      targetType: 'application',
      targetId: id,
    });
    res.status(204).end();
    return;
  }

  const input = parseBody(updateSchema, req);
  const updated = await db.application.update({ where: { id }, data: input });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'application.updated',
    targetType: 'application',
    targetId: id,
    metadata: input,
  });
  res.json({ data: updated });
});
