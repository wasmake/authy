import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { assignmentSchema } from '@/modules/applications/schemas';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['POST'])) return;
  const context = await requireContext(req);
  requireAdmin(context);
  const applicationId = String(req.query.id);
  const app = await db.application.findFirst({
    where: { id: applicationId, organizationId: context.organizationId },
  });
  if (!app) throw Object.assign(new Error('Application not found'), { statusCode: 404 });
  const input = parseBody(assignmentSchema, req);
  if (
    input.userId &&
    !(await db.membership.findUnique({
      where: {
        organizationId_userId: { organizationId: context.organizationId, userId: input.userId },
      },
    }))
  )
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  if (
    input.groupId &&
    !(await db.group.findFirst({
      where: { id: input.groupId, organizationId: context.organizationId },
    }))
  )
    throw Object.assign(new Error('Group not found'), { statusCode: 404 });
  const assignment = await db.applicationAssignment.create({ data: { applicationId, ...input } });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'application.assigned',
    targetType: 'application',
    targetId: applicationId,
  });
  res.status(201).json({ data: assignment });
});
