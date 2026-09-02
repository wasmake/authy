import { randomBytes } from 'crypto';

import { db } from '@/lib/db';
import type { AuthContext } from '@/modules/auth/context';

export async function listAvailableApplications(context: AuthContext, marketplace = false) {
  if (marketplace)
    return db.application.findMany({
      where: { organizationId: context.organizationId, isPublished: true },
      orderBy: { name: 'asc' },
    });
  return db.application.findMany({
    where: {
      organizationId: context.organizationId,
      OR: [
        { assignments: { some: { userId: context.userId } } },
        { assignments: { some: { group: { members: { some: { userId: context.userId } } } } } },
      ],
    },
    include: {
      favorites: { where: { userId: context.userId } },
      usage: { where: { userId: context.userId }, orderBy: { usedAt: 'desc' }, take: 1 },
    },
    orderBy: { name: 'asc' },
  });
}

export async function hasApplicationAccess(context: AuthContext, applicationId: string) {
  return Boolean(
    await db.application.findFirst({
      where: {
        id: applicationId,
        organizationId: context.organizationId,
        assignments: {
          some: {
            OR: [
              { userId: context.userId },
              { group: { members: { some: { userId: context.userId } } } },
            ],
          },
        },
      },
      select: { id: true },
    }),
  );
}

export function newClientId() {
  return `app_${randomBytes(12).toString('base64url')}`;
}
