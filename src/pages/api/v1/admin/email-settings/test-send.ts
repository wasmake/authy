import { apiHandler, method, parseBody } from '@/lib/api';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';
import { testEmailSchema } from '@/modules/email/schemas';
import { sendTestEmail } from '@/modules/integrations/email';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['POST'])) return;
  const context = await requireContext(req);
  requireAdmin(context);
  const input = parseBody(testEmailSchema, req);
  await sendTestEmail({ organizationId: context.organizationId, ...input });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'email_provider.test_sent',
    targetType: 'email_provider',
    metadata: { templateType: input.type, recipient: input.to },
  });
  res.json({ data: { sent: true } });
});
