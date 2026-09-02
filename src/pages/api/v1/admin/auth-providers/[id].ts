import { apiHandler, method } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['DELETE'])) return;
  const context = await requireContext(req);
  requireAdmin(context);
  const provider = await db.authProviderConfig.findFirst({
    where: { id: String(req.query.id), organizationId: context.organizationId },
  });
  if (!provider) throw Object.assign(new Error('Provider not found'), { statusCode: 404 });
  await db.$transaction(async (transaction) => {
    await transaction.authProviderConfig.delete({ where: { id: provider.id } });
    const enabledProviders = await transaction.authProviderConfig.count({
      where: { organizationId: context.organizationId, enabled: true },
    });
    await transaction.organization.update({
      where: { id: context.organizationId },
      data: { passwordLoginEnabled: enabledProviders === 0 },
    });
  });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'auth_provider.deleted',
    targetType: 'authProvider',
    targetId: provider.id,
  });
  res.status(204).end();
});
