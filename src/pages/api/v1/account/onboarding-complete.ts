import { apiHandler, method } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireContext } from '@/modules/auth/context';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['POST'])) return;
  const context = await requireContext(req);

  const user = await db.user.update({
    where: { id: context.userId },
    data: { onboardingCompletedAt: new Date() },
    select: { id: true, onboardingCompletedAt: true },
  });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'account.onboarding_completed',
    targetType: 'user',
    targetId: context.userId,
  });

  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ data: user });
});
