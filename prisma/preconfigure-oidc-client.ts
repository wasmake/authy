import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { parseOidcClients } from '../src/lib/oidc-clients';

const db = new PrismaClient();

async function main() {
  const additionalClients = parseOidcClients(
    process.env.OIDC_CLIENTS_JSON,
    process.env.OIDC_CLIENT_ID,
  );
  const clients = additionalClients
    .filter((client) => client.launchUrl)
    .map((client) => ({
      clientId: client.clientId,
      redirectUri: client.redirectUri,
      launchUrl: client.launchUrl!,
      name: client.name ?? 'OIDC Application',
      description: client.description ?? 'Managed OpenID Connect application.',
    }));

  const legacyClientId = process.env.OIDC_CLIENT_ID;
  const legacyRedirectUri = process.env.OIDC_REDIRECT_URI;
  const legacyLaunchUrl = process.env.OIDC_CLIENT_LAUNCH_URL;
  if (legacyClientId && legacyRedirectUri && legacyLaunchUrl) {
    clients.unshift({
      clientId: legacyClientId,
      redirectUri: legacyRedirectUri,
      launchUrl: legacyLaunchUrl,
      name: process.env.OIDC_CLIENT_NAME?.trim() || 'OIDC Application',
      description:
        process.env.OIDC_CLIENT_DESCRIPTION?.trim() || 'Managed OpenID Connect application.',
    });
  }

  for (const client of clients) {
    const existing = await db.application.findUnique({
      where: { clientId: client.clientId },
    });
    const organization = existing
      ? { id: existing.organizationId }
      : await db.organization.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
    if (!organization) {
      console.info('OIDC catalog application deferred until an organization exists.');
      return;
    }

    await db.application.deleteMany({
      where: {
        organizationId: organization.id,
        type: 'OIDC',
        name: { equals: client.name, mode: 'insensitive' },
        clientId: { not: client.clientId },
      },
    });

    const application = existing
      ? await db.application.update({
          where: { id: existing.id },
          data: {
            name: client.name,
            description: client.description,
            launchUrl: client.launchUrl,
            redirectUris: [client.redirectUri],
            isPublished: true,
          },
        })
      : await db.application.create({
          data: {
            organizationId: organization.id,
            name: client.name,
            description: client.description,
            type: 'OIDC',
            launchUrl: client.launchUrl,
            clientId: client.clientId,
            redirectUris: [client.redirectUri],
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

    console.info(`Preconfigured ${client.name} for ${memberships.length} Authy member(s).`);
  }
}

main()
  .catch((error) => {
    console.error('Unable to preconfigure the OIDC catalog application.', error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
