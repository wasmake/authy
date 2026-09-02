import { z } from 'zod';

import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';

const idList = z
  .array(z.string().trim().min(1))
  .max(200)
  .transform((values) => [...new Set(values)]);

const createUserSchema = z
  .object({
    email: z.string().trim().email().max(320),
    organizationRole: z.enum(['OWNER', 'ADMIN', 'MEMBER']).default('MEMBER'),
    roleIds: idList.default([]),
    groupIds: idList.default([]),
    applicationIds: idList.default([]),
  })
  .strict();

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET', 'POST'])) return;
  const context = await requireContext(req);
  requireAdmin(context);

  if (req.method === 'GET') {
    const [users, roles, groups, applications] = await Promise.all([
      listUsers(context.organizationId),
      db.role.findMany({
        where: { organizationId: context.organizationId },
        select: { id: true, name: true, description: true },
        orderBy: { name: 'asc' },
      }),
      db.group.findMany({
        where: { organizationId: context.organizationId },
        select: { id: true, name: true, description: true },
        orderBy: { name: 'asc' },
      }),
      db.application.findMany({
        where: { organizationId: context.organizationId },
        select: { id: true, name: true, type: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    res.json({ data: { users, roles, groups, applications } });
    return;
  }

  const input = parseBody(createUserSchema, req);
  await verifyTenantIds(context.organizationId, input);

  const user = await db.user.findFirst({
    where: { email: { equals: input.email, mode: 'insensitive' } },
    select: { id: true, email: true },
  });
  if (!user) {
    throw Object.assign(
      new Error('No account exists for this email. Ask the user to create an account first.'),
      { statusCode: 404 },
    );
  }

  const existing = await db.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: context.organizationId,
        userId: user.id,
      },
    },
    select: { id: true },
  });
  if (existing) {
    throw Object.assign(new Error('This user is already a member of the organization'), {
      statusCode: 409,
    });
  }

  const membership = await db.$transaction(async (transaction) => {
    const created = await transaction.membership.create({
      data: {
        organizationId: context.organizationId,
        userId: user.id,
        role: input.organizationRole,
        roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
      },
      select: { id: true },
    });
    if (input.groupIds.length) {
      await transaction.groupMember.createMany({
        data: input.groupIds.map((groupId) => ({ groupId, userId: user.id })),
      });
    }
    if (input.applicationIds.length) {
      await transaction.applicationAssignment.createMany({
        data: input.applicationIds.map((applicationId) => ({
          applicationId,
          userId: user.id,
          entitlements: [],
        })),
      });
    }
    return created;
  });

  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'membership.created',
    targetType: 'membership',
    targetId: membership.id,
    metadata: { userId: user.id, email: user.email, organizationRole: input.organizationRole },
  });

  const created = (await listUsers(context.organizationId, membership.id))[0];
  res.status(201).json({ data: created });
});

async function listUsers(organizationId: string, membershipId?: string) {
  const memberships = await db.membership.findMany({
    where: { organizationId, ...(membershipId ? { id: membershipId } : {}) },
    orderBy: { user: { name: 'asc' } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          suspendedAt: true,
          groupMembers: {
            where: { group: { organizationId } },
            select: { group: { select: { id: true, name: true } } },
            orderBy: { group: { name: 'asc' } },
          },
          assignments: {
            where: { application: { organizationId } },
            select: { application: { select: { id: true, name: true, type: true } } },
            orderBy: { application: { name: 'asc' } },
          },
        },
      },
      roles: {
        select: { role: { select: { id: true, name: true, description: true } } },
        orderBy: { role: { name: 'asc' } },
      },
    },
  });

  return memberships.map((membership) => ({
    id: membership.id,
    organizationRole: membership.role,
    status: membership.user.suspendedAt ? ('SUSPENDED' as const) : ('ACTIVE' as const),
    user: {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      image: membership.user.image,
    },
    roles: membership.roles.map(({ role }) => role),
    groups: membership.user.groupMembers.map(({ group }) => group),
    applications: membership.user.assignments.map(({ application }) => application),
  }));
}

async function verifyTenantIds(
  organizationId: string,
  input: { roleIds: string[]; groupIds: string[]; applicationIds: string[] },
) {
  const [roles, groups, applications] = await Promise.all([
    db.role.count({ where: { organizationId, id: { in: input.roleIds } } }),
    db.group.count({ where: { organizationId, id: { in: input.groupIds } } }),
    db.application.count({ where: { organizationId, id: { in: input.applicationIds } } }),
  ]);
  if (roles !== input.roleIds.length) tenantIdError('role');
  if (groups !== input.groupIds.length) tenantIdError('group');
  if (applications !== input.applicationIds.length) tenantIdError('application');
}

function tenantIdError(type: string): never {
  throw Object.assign(new Error(`One or more ${type} IDs do not belong to this organization`), {
    statusCode: 400,
  });
}
