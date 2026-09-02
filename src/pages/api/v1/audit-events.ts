import { apiHandler, method } from '@/lib/api';
import { db } from '@/lib/db';
import { requireAdmin, requireContext } from '@/modules/auth/context';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET'])) return;
  const context = await requireContext(req);
  requireAdmin(context);
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const where = { organizationId: context.organizationId };
  const [data, total] = await Promise.all([
    db.auditEvent.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    db.auditEvent.count({ where }),
  ]);
  res.json({ data, pagination: { page, pageSize, total } });
});
