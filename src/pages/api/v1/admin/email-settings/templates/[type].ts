import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';
import { emailTemplateSchema, emailTemplateTypeSchema } from '@/modules/email/schemas';
import {
  emailTemplateDefinitions,
  sanitizeTemplate,
  validateTemplatePlaceholders,
} from '@/modules/email/templates';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['PATCH', 'DELETE'])) return;
  const context = await requireContext(req);
  requireAdmin(context);
  const type = emailTemplateTypeSchema.parse(req.query.type);
  const definition = emailTemplateDefinitions[type];

  if (req.method === 'DELETE') {
    await db.emailTemplate.deleteMany({
      where: { organizationId: context.organizationId, type },
    });
    await audit({
      organizationId: context.organizationId,
      actorId: context.userId,
      action: 'email_template.reset',
      targetType: 'email_template',
      targetId: type,
    });
    res.json({
      data: {
        id: null,
        type,
        label: definition.label,
        description: definition.description,
        subject: definition.subject,
        html: definition.html,
        placeholders: definition.placeholders,
        customized: false,
        updatedAt: null,
      },
    });
    return;
  }

  const input = parseBody(emailTemplateSchema, req);
  validateTemplatePlaceholders(type, input.subject, input.html);
  const html = sanitizeTemplate(type, input.html);
  if (!html.trim())
    throw Object.assign(new Error('Template content cannot be empty'), { statusCode: 400 });
  const template = await db.emailTemplate.upsert({
    where: { organizationId_type: { organizationId: context.organizationId, type } },
    create: { organizationId: context.organizationId, type, subject: input.subject, html },
    update: { subject: input.subject, html },
    select: { id: true, type: true, subject: true, html: true, updatedAt: true },
  });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'email_template.updated',
    targetType: 'email_template',
    targetId: template.id,
    metadata: { type },
  });
  res.json({
    data: {
      ...template,
      label: definition.label,
      description: definition.description,
      placeholders: definition.placeholders,
      customized: true,
    },
  });
});
