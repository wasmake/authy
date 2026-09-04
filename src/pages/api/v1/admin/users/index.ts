import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod';

import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';
import { sendCredentials, sendInvitation } from '@/modules/integrations/email';
import { generateTemporaryPassword } from '@/modules/users/temporary-password';

const idList = z
  .array(z.string().trim().min(1))
  .max(200)
  .transform((values) => [...new Set(values)]);

const createUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(320),
    companyRole: z.string().trim().min(1).max(120),
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

  const existingUser = await db.user.findFirst({
    where: { email: { equals: input.email, mode: 'insensitive' } },
    select: { id: true, email: true, name: true },
  });

  if (existingUser) {
    const existingMembership = await db.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: context.organizationId,
          userId: existingUser.id,
        },
      },
      select: { id: true },
    });
    if (existingMembership) {
      throw Object.assign(new Error('This user is already a member of the organization'), {
        statusCode: 409,
      });
    }
  }

  const temporaryPassword = existingUser ? undefined : generateTemporaryPassword();
  const passwordHash = temporaryPassword ? await hashPassword(temporaryPassword) : undefined;
  const result = await db.$transaction(async (transaction) => {
    const user = existingUser
      ? existingUser
      : await transaction.user.create({
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            name: `${input.firstName} ${input.lastName}`,
            email: input.email.toLocaleLowerCase(),
            emailVerified: true,
            companyRole: input.companyRole,
            mustChangePassword: true,
          },
          select: { id: true, email: true },
        });

    if (passwordHash) {
      await transaction.account.create({
        data: {
          accountId: user.id,
          providerId: 'credential',
          userId: user.id,
          password: passwordHash,
        },
      });
    }

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
    return { membership: created, user };
  });

  try {
    if (temporaryPassword) {
      await sendCredentials({
        organizationId: context.organizationId,
        email: result.user.email,
        name: existingUser?.name ?? `${input.firstName} ${input.lastName}`,
        temporaryPassword,
      });
    } else {
      await sendInvitation({
        organizationId: context.organizationId,
        email: result.user.email,
        name: existingUser?.name ?? `${input.firstName} ${input.lastName}`,
        signInUrl: `${env.BETTER_AUTH_URL}/sign-in`,
      });
    }
  } catch (error) {
    if (existingUser) {
      await db.$transaction([
        db.applicationAssignment.deleteMany({
          where: { userId: result.user.id, applicationId: { in: input.applicationIds } },
        }),
        db.groupMember.deleteMany({
          where: { userId: result.user.id, groupId: { in: input.groupIds } },
        }),
        db.membership.delete({ where: { id: result.membership.id } }),
      ]);
    } else {
      await db.user.delete({ where: { id: result.user.id } });
    }
    throw error;
  }

  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'membership.created',
    targetType: 'membership',
    targetId: result.membership.id,
    metadata: {
      userId: result.user.id,
      email: result.user.email,
      organizationRole: input.organizationRole,
      invited: !existingUser,
      notification: existingUser ? 'organization_access' : 'temporary_credentials',
    },
  });

  const created = (await listUsers(context.organizationId, result.membership.id))[0];
  res.status(201).json({ data: { ...created, invited: !existingUser } });
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
          firstName: true,
          lastName: true,
          email: true,
          image: true,
          companyRole: true,
          suspendedAt: true,
          accounts: {
            where: { providerId: 'credential', password: { not: null } },
            select: { id: true },
            take: 1,
          },
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
      organization: { select: { passwordLoginEnabled: true } },
    },
  });

  return memberships.map((membership) => {
    const [legacyFirstName = membership.user.name, ...legacyLastName] = membership.user.name
      .trim()
      .split(/\s+/);

    return {
      id: membership.id,
      organizationRole: membership.role,
      status: membership.user.suspendedAt ? ('SUSPENDED' as const) : ('ACTIVE' as const),
      user: {
        id: membership.user.id,
        name: membership.user.name,
        firstName: membership.user.firstName?.trim() || legacyFirstName,
        lastName: membership.user.lastName?.trim() || legacyLastName.join(' '),
        email: membership.user.email,
        image: membership.user.image,
        companyRole: membership.user.companyRole,
      },
      roles: membership.roles.map(({ role }) => role),
      groups: membership.user.groupMembers.map(({ group }) => group),
      applications: membership.user.assignments.map(({ application }) => application),
      canRequestCredentialRegeneration:
        membership.organization.passwordLoginEnabled && Boolean(membership.user.accounts.length),
    };
  });
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
