import { Prisma } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod';

import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';

const setupSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(320),
    companyRole: z.string().trim().min(1).max(120),
    organizationName: z.string().trim().min(2).max(120),
    organizationSlug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(63)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Slug must use lowercase letters, numbers, and single hyphens',
      ),
    password: z
      .string()
      .min(14, 'Password must be at least 14 characters')
      .max(128, 'Password must be no more than 128 characters')
      .regex(/[a-z]/, 'Password must include a lowercase letter')
      .regex(/[A-Z]/, 'Password must include an uppercase letter')
      .regex(/[0-9]/, 'Password must include a number')
      .regex(/[^A-Za-z0-9]/, 'Password must include a symbol')
      .regex(/^\S+$/, 'Password must not contain spaces'),
    passwordConfirmation: z.string().max(128),
  })
  .strict()
  .refine((input) => input.password === input.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });

const permissionCatalog = [
  ['applications:read', 'View assigned and published applications'],
  ['applications:manage', 'Create and manage applications and assignments'],
  ['users:manage', 'Create and manage workforce identities'],
  ['groups:manage', 'Create and manage groups and role assignments'],
  ['organization:manage', 'Manage organization settings and authentication'],
  ['audit:read', 'View organization audit events'],
  ['api-keys:manage', 'Create and revoke service credentials'],
  ['vault:read', 'View assigned vault items'],
  ['vault:manage', 'Create and manage organization vault items'],
  ['access-requests:create', 'Request access to published applications'],
  ['access-requests:manage', 'Review and decide access requests'],
] as const;

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['POST'])) return;

  if ((await db.user.count()) !== 0) setupComplete();
  const input = parseBody(setupSchema, req);
  const passwordHash = await hashPassword(input.password);

  try {
    const result = await db.$transaction(
      async (transaction) => {
        if ((await transaction.user.count()) !== 0) setupComplete();

        const permissions = await Promise.all(
          permissionCatalog.map(([key, description]) =>
            transaction.permission.upsert({
              where: { key },
              update: { description },
              create: { key, description },
              select: { id: true, key: true },
            }),
          ),
        );
        const permissionIds = new Map(
          permissions.map((permission) => [permission.key, permission.id]),
        );

        const organization = await transaction.organization.create({
          data: { name: input.organizationName, slug: input.organizationSlug },
          select: { id: true, name: true, slug: true },
        });
        const ownerRole = await transaction.role.create({
          data: {
            organizationId: organization.id,
            name: 'Owner',
            description: 'Full administrative access to the organization',
            permissions: {
              create: permissions.map((permission) => ({ permissionId: permission.id })),
            },
          },
          select: { id: true },
        });
        await transaction.role.create({
          data: {
            organizationId: organization.id,
            name: 'Employee',
            description: 'Standard workforce access',
            permissions: {
              create: ['applications:read', 'vault:read', 'access-requests:create'].map((key) => ({
                permissionId: permissionIds.get(key) as string,
              })),
            },
          },
        });

        const user = await transaction.user.create({
          data: {
            name: `${input.firstName} ${input.lastName}`,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email.toLowerCase(),
            emailVerified: true,
            companyRole: input.companyRole,
            mustChangePassword: false,
            onboardingCompletedAt: new Date(),
            memberships: {
              create: {
                organizationId: organization.id,
                role: 'OWNER',
                roles: { create: { roleId: ownerRole.id } },
              },
            },
          },
          select: { id: true, email: true },
        });
        await transaction.account.create({
          data: {
            providerId: 'credential',
            accountId: user.id,
            userId: user.id,
            password: passwordHash,
          },
        });

        return { organization, user };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    res.status(201).json({ data: result });
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 409) {
      setupComplete();
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      if ((await db.user.count()) !== 0) setupComplete();
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      if ((await db.user.count()) !== 0) setupComplete();
      throw Object.assign(new Error('The organization slug is already in use'), {
        statusCode: 409,
      });
    }
    throw error;
  }
});

function setupComplete(): never {
  throw Object.assign(new Error('Setup has already been completed'), { statusCode: 409 });
}
