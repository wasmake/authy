import { apiHandler, method } from '@/lib/api';
import { db } from '@/lib/db';
import { requireContext } from '@/modules/auth/context';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET'])) return;
  const context = await requireContext(req);
  const user = await db.user.findUniqueOrThrow({
    where: { id: context.userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      memberships: {
        where: { organizationId: context.organizationId },
        include: {
          roles: {
            include: {
              role: { include: { permissions: { include: { permission: true } } } },
            },
          },
        },
      },
    },
  });
  res.json({
    data: {
      ...user,
      organizationId: context.organizationId,
      organizationRole: context.organizationRole,
    },
  });
});
