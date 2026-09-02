import { z } from 'zod';

import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';

import { listGroups } from './index';

const idList = z
  .array(z.string().trim().min(1))
  .max(200)
  .transform((values) => [...new Set(values)]);

const updateGroupSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    memberIds: idList.optional(),
    applicationIds: idList.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one change is required');

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['PATCH', 'DELETE'])) return;
  const context = await requireContext(req);
  requireAdmin(context);

  const groupId = String(req.query.id);
  const group = await db.group.findFirst({
    where: { id: groupId, organizationId: context.organizationId },
    select: { id: true, name: true },
  });
  if (!group) throw Object.assign(new Error('Group not found'), { statusCode: 404 });

  if (req.method === 'DELETE') {
    await db.group.delete({ where: { id: group.id } });
    await audit({
      organizationId: context.organizationId,
      actorId: context.userId,
      action: 'group.deleted',
      targetType: 'group',
      targetId: group.id,
      metadata: { name: group.name },
    });
    res.status(204).end();
    return;
  }

  const input = parseBody(updateGroupSchema, req);
  await verifyTenantIds(context.organizationId, input);
  if (input.name && input.name.toLocaleLowerCase() !== group.name.toLocaleLowerCase()) {
    const duplicate = await db.group.findFirst({
      where: {
        organizationId: context.organizationId,
        id: { not: group.id },
        name: { equals: input.name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw Object.assign(new Error('A group with this name already exists'), { statusCode: 409 });
    }
  }

  await db.$transaction(async (transaction) => {
    if (input.name !== undefined || input.description !== undefined) {
      await transaction.group.update({
        where: { id: group.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description || null } : {}),
        },
      });
    }
    if (input.memberIds) {
      await transaction.groupMember.deleteMany({ where: { groupId: group.id } });
      if (input.memberIds.length) {
        await transaction.groupMember.createMany({
          data: input.memberIds.map((userId) => ({ groupId: group.id, userId })),
        });
      }
    }
    if (input.applicationIds) {
      await transaction.applicationAssignment.deleteMany({ where: { groupId: group.id } });
      if (input.applicationIds.length) {
        await transaction.applicationAssignment.createMany({
          data: input.applicationIds.map((applicationId) => ({
            applicationId,
            groupId: group.id,
            entitlements: [],
          })),
        });
      }
    }
  });

  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'group.updated',
    targetType: 'group',
    targetId: group.id,
    metadata: { changedFields: Object.keys(input) },
  });
  const updated = (await listGroups(context.organizationId, group.id))[0];
  res.json({ data: updated });
});

async function verifyTenantIds(
  organizationId: string,
  input: { memberIds?: string[]; applicationIds?: string[] },
) {
  const [members, applications] = await Promise.all([
    input.memberIds
      ? db.membership.count({ where: { organizationId, userId: { in: input.memberIds } } })
      : undefined,
    input.applicationIds
      ? db.application.count({ where: { organizationId, id: { in: input.applicationIds } } })
      : undefined,
  ]);
  if (input.memberIds && members !== input.memberIds.length) tenantIdError('member');
  if (input.applicationIds && applications !== input.applicationIds.length) {
    tenantIdError('application');
  }
}

function tenantIdError(type: string): never {
  throw Object.assign(new Error(`One or more ${type} IDs do not belong to this organization`), {
    statusCode: 400,
  });
}
