import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';
import { emailProviderSchema } from '@/modules/email/schemas';
import { emailTemplateDefinitions } from '@/modules/email/templates';
import { encryptSecret } from '@/modules/security/encryption';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET', 'PATCH'])) return;
  const context = await requireContext(req);
  requireAdmin(context);
  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method === 'GET') {
    const [organization, provider, customizedTemplates] = await Promise.all([
      db.organization.findUniqueOrThrow({
        where: { id: context.organizationId },
        select: { name: true },
      }),
      db.emailProviderConfig.findUnique({
        where: { organizationId: context.organizationId },
        select: {
          id: true,
          enabled: true,
          fromName: true,
          fromEmail: true,
          replyTo: true,
          updatedAt: true,
        },
      }),
      db.emailTemplate.findMany({
        where: { organizationId: context.organizationId },
        select: { id: true, type: true, subject: true, html: true, updatedAt: true },
      }),
    ]);
    const customized = new Map(customizedTemplates.map((template) => [template.type, template]));
    res.json({
      data: {
        provider: provider
          ? { ...provider, apiKeyConfigured: true }
          : {
              id: null,
              enabled: false,
              fromName: organization.name,
              fromEmail: '',
              replyTo: null,
              updatedAt: null,
              apiKeyConfigured: false,
            },
        templates: Object.values(emailTemplateDefinitions).map((definition) => {
          const template = customized.get(definition.type);
          return {
            id: template?.id ?? null,
            type: definition.type,
            label: definition.label,
            description: definition.description,
            subject: template?.subject ?? definition.subject,
            html: template?.html ?? definition.html,
            placeholders: definition.placeholders,
            customized: Boolean(template),
            updatedAt: template?.updatedAt ?? null,
          };
        }),
      },
    });
    return;
  }

  const input = parseBody(emailProviderSchema, req);
  const existing = await db.emailProviderConfig.findUnique({
    where: { organizationId: context.organizationId },
    select: { id: true },
  });
  if (!existing && !input.resendApiKey) {
    throw Object.assign(new Error('Resend API key is required'), { statusCode: 400 });
  }
  const provider = await db.emailProviderConfig.upsert({
    where: { organizationId: context.organizationId },
    create: {
      organizationId: context.organizationId,
      resendApiKeyEncrypted: encryptSecret(input.resendApiKey ?? ''),
      fromName: input.fromName,
      fromEmail: input.fromEmail.toLowerCase(),
      replyTo: input.replyTo?.toLowerCase() || null,
      enabled: input.enabled,
    },
    update: {
      ...(input.resendApiKey ? { resendApiKeyEncrypted: encryptSecret(input.resendApiKey) } : {}),
      fromName: input.fromName,
      fromEmail: input.fromEmail.toLowerCase(),
      replyTo: input.replyTo?.toLowerCase() || null,
      enabled: input.enabled,
    },
    select: {
      id: true,
      enabled: true,
      fromName: true,
      fromEmail: true,
      replyTo: true,
      updatedAt: true,
    },
  });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'email_provider.configured',
    targetType: 'email_provider',
    targetId: provider.id,
    metadata: { enabled: provider.enabled, fromEmail: provider.fromEmail },
  });
  res.json({ data: { ...provider, apiKeyConfigured: true } });
});
