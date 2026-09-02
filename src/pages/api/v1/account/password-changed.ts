import { apiHandler, method } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireContext } from '@/modules/auth/context';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['POST'])) return;
  const context = await requireContext(req);

  const user = await db.user.findUniqueOrThrow({
    where: { id: context.userId },
    select: { id: true, mustChangePassword: true, onboardingCompletedAt: true },
  });
  if (user.mustChangePassword) {
    throw Object.assign(new Error('Change the temporary password before continuing'), {
      statusCode: 409,
    });
  }
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'account.password_changed',
    targetType: 'user',
    targetId: context.userId,
  });

  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ data: user });
});
