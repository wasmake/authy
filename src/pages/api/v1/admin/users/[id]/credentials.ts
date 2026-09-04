import { hashPassword } from 'better-auth/crypto';

import { apiHandler, method } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';
import { sendCredentials } from '@/modules/integrations/email';
import { canRegenerateCredentials } from '@/modules/users/credential-management';
import { generateTemporaryPassword } from '@/modules/users/temporary-password';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['POST'])) return;
  const context = await requireContext(req);
  requireAdmin(context);

  const membership = await db.membership.findFirst({
    where: { id: String(req.query.id), organizationId: context.organizationId },
    select: { id: true, userId: true },
  });
  if (!membership) {
    throw Object.assign(new Error('Organization membership not found'), { statusCode: 404 });
  }
  if (membership.userId === context.userId) {
    throw Object.assign(new Error('You cannot regenerate your own credentials'), {
      statusCode: 400,
    });
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await db.$transaction(
    async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${membership.userId} FOR UPDATE`;
      const current = await transaction.membership.findFirst({
        where: { id: membership.id, organizationId: context.organizationId },
        select: {
          userId: true,
          organization: { select: { passwordLoginEnabled: true } },
          user: {
            select: {
              name: true,
              email: true,
              accounts: {
                where: { providerId: 'credential', password: { not: null } },
                select: { id: true },
                take: 1,
              },
              _count: { select: { memberships: true } },
            },
          },
        },
      });
      const account = current?.user.accounts[0];
      if (
        !current ||
        !account ||
        !canRegenerateCredentials({
          passwordLoginEnabled: current.organization.passwordLoginEnabled,
          hasCredentialAccount: true,
          membershipCount: current.user._count.memberships,
        })
      ) {
        throw Object.assign(new Error('Credential regeneration is unavailable for this member'), {
          statusCode: 400,
        });
      }

      await sendCredentials({
        organizationId: context.organizationId,
        email: current.user.email,
        name: current.user.name,
        temporaryPassword,
      });
      await transaction.account.update({
        where: { id: account.id },
        data: { password: passwordHash },
      });
      await transaction.user.update({
        where: { id: current.userId },
        data: { mustChangePassword: true },
      });
      await transaction.session.deleteMany({ where: { userId: current.userId } });
      await transaction.oauthAccessToken.deleteMany({ where: { userId: current.userId } });
    },
    { maxWait: 5_000, timeout: 30_000 },
  );

  await db.$transaction([
    db.session.deleteMany({ where: { userId: membership.userId } }),
    db.oauthAccessToken.deleteMany({ where: { userId: membership.userId } }),
  ]);

  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'user.credentials_regenerated',
    targetType: 'user',
    targetId: membership.userId,
    metadata: { membershipId: membership.id, sessionsRevoked: true, oidcGrantsRevoked: true },
  });
  res.json({ data: { sent: true, mustChangePassword: true } });
});
