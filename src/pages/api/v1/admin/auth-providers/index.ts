import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';
import { providerSchema } from '@/modules/auth/provider-schemas';
import { encryptSecret } from '@/modules/security/encryption';

const safeSelect = {
  id: true,
  type: true,
  displayName: true,
  clientId: true,
  tenantId: true,
  domainHint: true,
  enabled: true,
  updatedAt: true,
} as const;

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET', 'POST'])) return;
  const context = await requireContext(req);
  requireAdmin(context);
  if (req.method === 'GET') {
    const providers = await db.authProviderConfig.findMany({
      where: { organizationId: context.organizationId },
      select: safeSelect,
      orderBy: { type: 'asc' },
    });
    const organization = await db.organization.findUniqueOrThrow({
      where: { id: context.organizationId },
      select: { passwordLoginEnabled: true },
    });
    res.json({
      data: {
        providers,
        passwordLoginEnabled: organization.passwordLoginEnabled,
        callbackUrl: `${env.BETTER_AUTH_URL}/api/auth/callback/{provider}`,
      },
    });
    return;
  }
  const input = parseBody(providerSchema, req);
  const existing = await db.authProviderConfig.findUnique({
    where: {
      organizationId_type: { organizationId: context.organizationId, type: input.type },
    },
  });
  if (!existing && !input.clientSecret) {
    throw Object.assign(new Error('Client secret is required'), { statusCode: 400 });
  }
  if (input.enabled) {
    const anotherTenant = await db.authProviderConfig.findFirst({
      where: { enabled: true, organizationId: { not: context.organizationId } },
      select: { id: true },
    });
    if (anotherTenant) {
      throw Object.assign(
        new Error('Another organization already owns the active platform SSO connection'),
        { statusCode: 409 },
      );
    }
  }
  const provider = await db.$transaction(async (tx) => {
    if (input.enabled) {
      await tx.authProviderConfig.updateMany({
        where: { organizationId: context.organizationId },
        data: { enabled: false },
      });
    }
    const value = await tx.authProviderConfig.upsert({
      where: {
        organizationId_type: { organizationId: context.organizationId, type: input.type },
      },
      create: {
        organizationId: context.organizationId,
        type: input.type,
        displayName: input.displayName,
        clientId: input.clientId,
        clientSecretEncrypted: encryptSecret(input.clientSecret ?? ''),
        tenantId: input.tenantId || null,
        domainHint: input.domainHint || null,
        enabled: input.enabled,
      },
      update: {
        displayName: input.displayName,
        clientId: input.clientId,
        ...(input.clientSecret ? { clientSecretEncrypted: encryptSecret(input.clientSecret) } : {}),
        tenantId: input.tenantId || null,
        domainHint: input.domainHint || null,
        enabled: input.enabled,
      },
      select: safeSelect,
    });
    const enabledProviders = await tx.authProviderConfig.count({
      where: { organizationId: context.organizationId, enabled: true },
    });
    await tx.organization.update({
      where: { id: context.organizationId },
      data: { passwordLoginEnabled: enabledProviders === 0 },
    });
    return value;
  });
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'auth_provider.configured',
    targetType: 'authProvider',
    targetId: provider.id,
    metadata: { type: provider.type, enabled: provider.enabled },
  });
  res.status(existing ? 200 : 201).json({ data: provider });
});
