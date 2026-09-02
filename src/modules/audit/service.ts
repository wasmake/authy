import type { Prisma } from '@prisma/client';

import { db } from '@/lib/db';

export async function audit(input: {
  organizationId: string;
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  ipAddress?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await db.auditEvent.create({ data: input });
}
