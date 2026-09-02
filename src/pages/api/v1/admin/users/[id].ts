import { z } from 'zod';

import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';

const idList = z
  .array(z.string().trim().min(1))
  .max(200)
  .transform((values) => [...new Set(values)]);

const updateUserSchema = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    organizationRole: z.enum(['OWNER', 'ADMIN', 'MEMBER']).optional(),
    roleIds: idList.optional(),
    groupIds: idList.optional(),
    applicationIds: idList.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one change is required');

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['PATCH', 'DELETE'])) return;
  const context = await requireContext(req);
  requireAdmin(context);

  const membershipId = String(req.query.id);
  const membership = await db.membership.findFirst({
    where: { id: membershipId, organizationId: context.organizationId },
    select: { id: true, userId: true, role: true, user: { select: { suspendedAt: true } } },
  });
  if (!membership) {
    throw Object.assign(new Error('Organization membership not found'), { statusCode: 404 });
  }

  if (req.method === 'DELETE') {
    if (membership.userId === context.userId) {
      throw Object.assign(new Error('You cannot remove your own organization membership'), {
        statusCode: 400,
      });
    }

    await db.$transaction([
      db.groupMember.deleteMany({
        where: { userId: membership.userId, group: { organizationId: context.organizationId } },
      }),
      db.applicationAssignment.deleteMany({
        where: {
          userId: membership.userId,
          application: { organizationId: context.organizationId },
        },
      }),
      db.membership.delete({ where: { id: membership.id } }),
    ]);
    await audit({
      organizationId: context.organizationId,
      actorId: context.userId,
      action: 'membership.deleted',
      targetType: 'membership',
      targetId: membership.id,
      metadata: { userId: membership.userId },
    });
    res.status(204).end();
    return;
  }

  const input = parseBody(updateUserSchema, req);
  await verifyTenantIds(context.organizationId, input);

  await db.$transaction(async (transaction) => {
    if (input.organizationRole) {
      await transaction.membership.update({
        where: { id: membership.id },
        data: { role: input.organizationRole },
      });
    }
    if (input.status) {
      await transaction.user.update({
        where: { id: membership.userId },
        data: { suspendedAt: input.status === 'SUSPENDED' ? new Date() : null },
      });
    }
    if (input.roleIds) {
      await transaction.membershipRole.deleteMany({ where: { membershipId: membership.id } });
      if (input.roleIds.length) {
        await transaction.membershipRole.createMany({
          data: input.roleIds.map((roleId) => ({ membershipId: membership.id, roleId })),
        });
      }
    }
    if (input.groupIds) {
      await transaction.groupMember.deleteMany({
        where: { userId: membership.userId, group: { organizationId: context.organizationId } },
      });
      if (input.groupIds.length) {
        await transaction.groupMember.createMany({
          data: input.groupIds.map((groupId) => ({ groupId, userId: membership.userId })),
        });
      }
    }
    if (input.applicationIds) {
      await transaction.applicationAssignment.deleteMany({
        where: {
          userId: membership.userId,
          application: { organizationId: context.organizationId },
        },
      });
      if (input.applicationIds.length) {
        await transaction.applicationAssignment.createMany({
          data: input.applicationIds.map((applicationId) => ({
            applicationId,
            userId: membership.userId,
            entitlements: [],
          })),
        });
      }
    }
  });

  const changedFields = Object.keys(input);
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'membership.updated',
    targetType: 'membership',
    targetId: membership.id,
    metadata: { userId: membership.userId, changedFields },
  });
  res.json({
    data: {
      id: membership.id,
      userId: membership.userId,
      organizationRole: input.organizationRole ?? membership.role,
      status:
        input.status ??
        (membership.user.suspendedAt ? ('SUSPENDED' as const) : ('ACTIVE' as const)),
    },
  });
});

async function verifyTenantIds(
  organizationId: string,
  input: { roleIds?: string[]; groupIds?: string[]; applicationIds?: string[] },
) {
  const [roles, groups, applications] = await Promise.all([
    input.roleIds
      ? db.role.count({ where: { organizationId, id: { in: input.roleIds } } })
      : undefined,
    input.groupIds
      ? db.group.count({ where: { organizationId, id: { in: input.groupIds } } })
      : undefined,
    input.applicationIds
      ? db.application.count({ where: { organizationId, id: { in: input.applicationIds } } })
      : undefined,
  ]);
  if (input.roleIds && roles !== input.roleIds.length) tenantIdError('role');
  if (input.groupIds && groups !== input.groupIds.length) tenantIdError('group');
  if (input.applicationIds && applications !== input.applicationIds.length) {
    tenantIdError('application');
  }
}

function tenantIdError(type: string): never {
  throw Object.assign(new Error(`One or more ${type} IDs do not belong to this organization`), {
    statusCode: 400,
  });
}
