import { apiHandler, method } from '@/lib/api';
import { db } from '@/lib/db';
import { hasApplicationAccess } from '@/modules/applications/service';
import { audit } from '@/modules/audit/service';
import { requireContext } from '@/modules/auth/context';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET'])) return;
  const context = await requireContext(req);
  const id = String(req.query.id);
  if (!(await hasApplicationAccess(context, id)))
    throw Object.assign(new Error('Application access denied'), { statusCode: 403 });
  const app = await db.application.findFirst({
    where: { id, organizationId: context.organizationId },
  });
  if (!app?.launchUrl)
    throw Object.assign(new Error('Application launch URL is not configured'), { statusCode: 409 });
  await db.appUsage.create({ data: { userId: context.userId, applicationId: id } });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'application.launched',
    targetType: 'application',
    targetId: id,
  });
  res.redirect(302, app.launchUrl);
});
