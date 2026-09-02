import type { OrganizationRole } from '@prisma/client';
import { fromNodeHeaders } from 'better-auth/node';
import type { NextApiRequest } from 'next';

import { db } from '@/lib/db';
import { getAuth } from '@/modules/auth/server';

export type AuthContext = {
  userId: string;
  organizationId: string;
  organizationRole: OrganizationRole;
};

export async function requireContext(req: NextApiRequest): Promise<AuthContext> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw Object.assign(new Error('Authentication required'), { statusCode: 401 });

  const requestedOrg = req.headers['x-organization-id'];
  const membership = await db.membership.findFirst({
    where: {
      userId: session.user.id,
      ...(typeof requestedOrg === 'string' ? { organizationId: requestedOrg } : {}),
    },
    include: { user: { select: { suspendedAt: true, mustChangePassword: true } } },
    orderBy: { role: 'asc' },
  });
  if (!membership)
    throw Object.assign(new Error('Organization access denied'), { statusCode: 403 });
  if (membership.user.suspendedAt)
    throw Object.assign(new Error('This account is suspended'), { statusCode: 403 });
  const path = req.url?.split('?')[0];
  if (
    membership.user.mustChangePassword &&
    path !== '/api/v1/me' &&
    path !== '/api/v1/account/password-changed'
  ) {
    throw Object.assign(new Error('Password change required before accessing this resource'), {
      statusCode: 403,
    });
  }
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
