import type { OrganizationRole } from '@prisma/client';
import { fromNodeHeaders } from 'better-auth/node';
import type { NextApiRequest } from 'next';

import { db } from '@/lib/db';
import { auth } from '@/modules/auth/server';

export type AuthContext = {
  userId: string;
  organizationId: string;
  organizationRole: OrganizationRole;
};

export async function requireContext(req: NextApiRequest): Promise<AuthContext> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw Object.assign(new Error('Authentication required'), { statusCode: 401 });

  const requestedOrg = req.headers['x-organization-id'];
  const membership = await db.membership.findFirst({
    where: {
      userId: session.user.id,
      ...(typeof requestedOrg === 'string' ? { organizationId: requestedOrg } : {}),
    },
    orderBy: { role: 'asc' },
  });
  if (!membership)
    throw Object.assign(new Error('Organization access denied'), { statusCode: 403 });
  return {
    userId: session.user.id,
    organizationId: membership.organizationId,
    organizationRole: membership.role,
  };
}

export function requireAdmin(context: AuthContext): void {
  if (!['OWNER', 'ADMIN'].includes(context.organizationRole)) {
    throw Object.assign(new Error('Administrator access required'), { statusCode: 403 });
  }
}
