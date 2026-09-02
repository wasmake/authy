import { z } from 'zod';

import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';

const idList = z
  .array(z.string().trim().min(1))
  .max(200)
  .transform((values) => [...new Set(values)]);

const createGroupSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).nullable().optional(),
    memberIds: idList.default([]),
    applicationIds: idList.default([]),
  })
  .strict();

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET', 'POST'])) return;
  const context = await requireContext(req);
  requireAdmin(context);

  if (req.method === 'GET') {
    const [groups, applications, memberships] = await Promise.all([
      listGroups(context.organizationId),
      db.application.findMany({
        where: { organizationId: context.organizationId },
        select: { id: true, name: true, type: true },
        orderBy: { name: 'asc' },
      }),
      db.membership.findMany({
        where: { organizationId: context.organizationId },
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true, suspendedAt: true } },
        },
        orderBy: { user: { name: 'asc' } },
      }),
    ]);
    const users = memberships.map(({ role, user }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      organizationRole: role,
      status: user.suspendedAt ? ('SUSPENDED' as const) : ('ACTIVE' as const),
    }));
    res.json({ data: { groups, applications, users } });
    return;
  }

  const input = parseBody(createGroupSchema, req);
  await verifyTenantIds(context.organizationId, input);
  await ensureNameAvailable(context.organizationId, input.name);

  const group = await db.group.create({
    data: {
      organizationId: context.organizationId,
      name: input.name,
      description: input.description || null,
      members: { create: input.memberIds.map((userId) => ({ userId })) },
      assignments: {
        create: input.applicationIds.map((applicationId) => ({
          applicationId,
          entitlements: [],
        })),
      },
    },
    select: { id: true },
  });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'group.created',
    targetType: 'group',
    targetId: group.id,
    metadata: { name: input.name },
  });

  const created = (await listGroups(context.organizationId, group.id))[0];
  res.status(201).json({ data: created });
});

export async function listGroups(organizationId: string, groupId?: string) {
  const groups = await db.group.findMany({
    where: { organizationId, ...(groupId ? { id: groupId } : {}) },
    orderBy: { name: 'asc' },
    include: {
      members: {
        select: { user: { select: { id: true, name: true, email: true, suspendedAt: true } } },
        orderBy: { user: { name: 'asc' } },
      },
      assignments: {
        select: { application: { select: { id: true, name: true, type: true } } },
        orderBy: { application: { name: 'asc' } },
      },
    },
  });

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    members: group.members.map(({ user }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.suspendedAt ? ('SUSPENDED' as const) : ('ACTIVE' as const),
    })),
    applications: group.assignments.map(({ application }) => application),
  }));
}

async function verifyTenantIds(
  organizationId: string,
  input: { memberIds: string[]; applicationIds: string[] },
) {
  const [members, applications] = await Promise.all([
    db.membership.count({ where: { organizationId, userId: { in: input.memberIds } } }),
    db.application.count({ where: { organizationId, id: { in: input.applicationIds } } }),
  ]);
  if (members !== input.memberIds.length) tenantIdError('member');
  if (applications !== input.applicationIds.length) tenantIdError('application');
}

async function ensureNameAvailable(organizationId: string, name: string) {
  const existing = await db.group.findFirst({
    where: { organizationId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) {
    throw Object.assign(new Error('A group with this name already exists'), { statusCode: 409 });
  }
}

function tenantIdError(type: string): never {
  throw Object.assign(new Error(`One or more ${type} IDs do not belong to this organization`), {
    statusCode: 400,
  });
}
