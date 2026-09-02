import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { decisionSchema } from '@/modules/applications/schemas';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['PATCH'])) return;
  const context = await requireContext(req);
  requireAdmin(context);
  const input = parseBody(decisionSchema, req);
  const request = await db.accessRequest.findFirst({
    where: { id: String(req.query.id), organizationId: context.organizationId, status: 'PENDING' },
  });
  if (!request) throw Object.assign(new Error('Pending request not found'), { statusCode: 404 });
  const result = await db.$transaction(async (tx) => {
    if (input.status === 'APPROVED')
      await tx.applicationAssignment.upsert({
        where: {
          applicationId_userId: {
            applicationId: request.applicationId,
            userId: request.requesterId,
          },
        },
        create: {
          applicationId: request.applicationId,
          userId: request.requesterId,
          entitlements: [],
        },
        update: {},
      });
    return tx.accessRequest.update({
      where: { id: request.id },
      data: {
        status: input.status,
        decisionNote: input.note,
        reviewerId: context.userId,
        decidedAt: new Date(),
      },
    });
  });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: `access.${input.status.toLowerCase()}`,
    targetType: 'accessRequest',
    targetId: request.id,
  });
  res.json({ data: result });
});
