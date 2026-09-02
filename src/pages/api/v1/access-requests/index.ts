import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { accessRequestSchema } from '@/modules/applications/schemas';
import { audit } from '@/modules/audit/service';
import { requireContext } from '@/modules/auth/context';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET', 'POST'])) return;
  const context = await requireContext(req);
  if (req.method === 'GET') {
    const admin = ['OWNER', 'ADMIN'].includes(context.organizationRole);
    const requests = await db.accessRequest.findMany({
      where: {
        organizationId: context.organizationId,
        ...(admin ? {} : { requesterId: context.userId }),
      },
      include: {
        application: { select: { name: true } },
        requester: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: requests });
    return;
  }
  const input = parseBody(accessRequestSchema, req);
  const app = await db.application.findFirst({
    where: { id: input.applicationId, organizationId: context.organizationId, isPublished: true },
  });
  if (!app) throw Object.assign(new Error('Application not found'), { statusCode: 404 });
  const request = await db.accessRequest.create({
    data: { ...input, organizationId: context.organizationId, requesterId: context.userId },
  });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'access.requested',
    targetType: 'accessRequest',
    targetId: request.id,
  });
  res.status(201).json({ data: request });
});
