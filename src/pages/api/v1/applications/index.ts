import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { applicationSchema } from '@/modules/applications/schemas';
import { listAvailableApplications, newClientId } from '@/modules/applications/service';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET', 'POST'])) return;
  const context = await requireContext(req);
  if (req.method === 'GET') {
    const apps = await listAvailableApplications(context, req.query.marketplace === 'true');
    res.json({ data: apps });
    return;
  }
  requireAdmin(context);
  const input = parseBody(applicationSchema, req);
  const app = await db.application.create({
    data: {
      ...input,
      organizationId: context.organizationId,
      clientId: input.type === 'OIDC' ? newClientId() : null,
    },
  });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'application.created',
    targetType: 'application',
    targetId: app.id,
  });
  res.status(201).json({ data: app });
});
