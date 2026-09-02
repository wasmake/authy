import { apiHandler, method } from '@/lib/api';
import { db } from '@/lib/db';
import { requireAdmin, requireContext } from '@/modules/auth/context';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET'])) return;
  const context = await requireContext(req);
  requireAdmin(context);
  const [users, applications, pendingRequests, signIns, securityEvents] = await Promise.all([
    db.membership.count({ where: { organizationId: context.organizationId } }),
    db.application.count({ where: { organizationId: context.organizationId } }),
    db.accessRequest.count({
      where: { organizationId: context.organizationId, status: 'PENDING' },
    }),
    db.auditEvent.count({
      where: { organizationId: context.organizationId, action: 'auth.sign_in' },
    }),
    db.auditEvent.count({
      where: { organizationId: context.organizationId, action: { startsWith: 'security.' } },
    }),
  ]);
  res.json({ data: { users, applications, pendingRequests, signIns, securityEvents } });
});
