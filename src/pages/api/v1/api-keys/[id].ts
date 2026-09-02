import { apiHandler, method } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['DELETE'])) return;
  const context = await requireContext(req);
  requireAdmin(context);
  const result = await db.apiKey.updateMany({
    where: { id: String(req.query.id), organizationId: context.organizationId, status: 'ACTIVE' },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });
  if (!result.count)
    throw Object.assign(new Error('Active API key not found'), { statusCode: 404 });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'api_key.revoked',
    targetType: 'apiKey',
    targetId: String(req.query.id),
  });
  res.status(204).end();
});
