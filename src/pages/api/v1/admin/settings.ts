import { z } from 'zod';

import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';

const logoSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'Logo must use an HTTP or HTTPS URL',
  });

export const organizationSettingsSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    greeting: z.string().trim().min(2).max(160).optional(),
    logo: logoSchema.nullable().optional(),
    primaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Primary color must be a six-digit hex color')
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one setting is required');

const select = {
  name: true,
  greeting: true,
  logo: true,
  primaryColor: true,
} as const;

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET', 'PATCH'])) return;
  const context = await requireContext(req);
  requireAdmin(context);

  const current = await db.organization.findUniqueOrThrow({
    where: { id: context.organizationId },
    select,
  });
  if (req.method === 'GET') {
    res.json({ data: current });
    return;
  }

  const input = parseBody(organizationSettingsSchema, req);
  const changedFields = (Object.keys(input) as (keyof typeof input)[]).filter(
    (field) => input[field] !== current[field],
  );
  if (!changedFields.length) {
    res.json({ data: current });
    return;
  }

  const settings = await db.organization.update({
    where: { id: context.organizationId },
    data: input,
    select,
  });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'organization.settings.updated',
    targetType: 'organization',
    targetId: context.organizationId,
    metadata: { changedFields },
  });
  res.json({ data: settings });
});
