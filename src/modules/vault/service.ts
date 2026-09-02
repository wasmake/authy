import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import type { AuthContext } from '@/modules/auth/context';

export const vaultMetadataSelect = Prisma.validator<Prisma.VaultItemSelect>()({
  id: true,
  name: true,
  type: true,
  username: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  assignments: {
    select: {
      id: true,
      user: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } },
    },
    orderBy: { id: 'asc' },
  },
});

export function isVaultAdmin(context: AuthContext): boolean {
  return context.organizationRole === 'OWNER' || context.organizationRole === 'ADMIN';
}

export function accessibleVaultWhere(context: AuthContext): Prisma.VaultItemWhereInput {
  return {
    organizationId: context.organizationId,
    ...(isVaultAdmin(context)
      ? {}
      : {
          assignments: {
            some: {
              OR: [
                { userId: context.userId },
                { group: { members: { some: { userId: context.userId } } } },
              ],
            },
          },
        }),
  };
}

export async function verifyVaultAssignments(
  organizationId: string,
  input: { userIds: string[]; groupIds: string[] },
): Promise<void> {
  const [users, groups] = await Promise.all([
    db.membership.count({
      where: { organizationId, userId: { in: input.userIds } },
    }),
    db.group.count({
      where: { organizationId, id: { in: input.groupIds } },
    }),
  ]);
  if (users !== input.userIds.length || groups !== input.groupIds.length) {
    throw Object.assign(new Error('One or more assignments do not belong to this organization'), {
      statusCode: 400,
    });
  }
}

export function vaultAssignmentRows(
  vaultItemId: string,
  input: { userIds: string[]; groupIds: string[] },
) {
  return [
    ...input.userIds.map((userId) => ({ vaultItemId, userId })),
    ...input.groupIds.map((groupId) => ({ vaultItemId, groupId })),
  ];
}

export async function ensureVaultNameAvailable(
  organizationId: string,
  name: string,
  excludedId?: string,
): Promise<void> {
  const existing = await db.vaultItem.findFirst({
    where: {
      organizationId,
      name: { equals: name, mode: 'insensitive' },
      ...(excludedId ? { id: { not: excludedId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw Object.assign(new Error('A vault item with this name already exists'), {
      statusCode: 409,
    });
  }
}

export function secretFromCreateInput(
  input:
    | { type: 'CREDENTIAL'; password: string }
    | { type: 'SECRET'; value: string }
    | { type: 'ENVIRONMENT'; content: string },
): string {
  if (input.type === 'CREDENTIAL') return input.password;
  if (input.type === 'SECRET') return input.value;
  return input.content;
}

export function secretFromUpdateInput(
  input:
    | { type: 'CREDENTIAL'; password?: string }
    | { type: 'SECRET'; value?: string }
    | { type: 'ENVIRONMENT'; content?: string },
): string | undefined {
  if (input.type === 'CREDENTIAL') return input.password;
  if (input.type === 'SECRET') return input.value;
  return input.content;
}
