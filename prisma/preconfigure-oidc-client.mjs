import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const clientId = process.env.OIDC_CLIENT_ID;
  const redirectUri = process.env.OIDC_REDIRECT_URI;
  const launchUrl = process.env.OIDC_CLIENT_LAUNCH_URL;
  if (!clientId || !redirectUri || !launchUrl) return;

  const existing = await db.application.findUnique({ where: { clientId } });
  const organization = existing
    ? { id: existing.organizationId }
    : await db.organization.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!organization) {
    console.info('OIDC catalog application deferred until an organization exists.');
    return;
  }

  const application = await db.application.upsert({
    where: { clientId },
    update: {
      name: 'ChatbotX',
      description: 'Build and manage conversational experiences with Authy single sign-on.',
      type: 'OIDC',
      launchUrl,
      redirectUris: [redirectUri],
      scopes: ['openid', 'profile', 'email'],
      claims: { email_verified: true },
      isPublished: true,
    },
    create: {
      organizationId: organization.id,
      name: 'ChatbotX',
      description: 'Build and manage conversational experiences with Authy single sign-on.',
      type: 'OIDC',
      launchUrl,
      clientId,
      redirectUris: [redirectUri],
      scopes: ['openid', 'profile', 'email'],
      claims: { email_verified: true },
      isPublished: true,
    },
  });

  const memberships = await db.membership.findMany({
    where: { organizationId: application.organizationId },
    select: { userId: true },
  });
  await db.applicationAssignment.createMany({
    data: memberships.map(({ userId }) => ({
      id: randomUUID(),
      applicationId: application.id,
      userId,
      entitlements: ['openid', 'profile', 'email'],
    })),
    skipDuplicates: true,
  });

  console.info(`Preconfigured ChatbotX for ${memberships.length} Authy member(s).`);
}

main()
  .catch((error) => {
    console.error('Unable to preconfigure the OIDC catalog application.', error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
