import { APIError, betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware } from 'better-auth/api';
import { jwt, oidcProvider } from 'better-auth/plugins';
import type { SocialProviders } from 'better-auth/social-providers';

import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { decryptSecret } from '@/modules/security/encryption';

export async function getAuth() {
  const configured = await db.authProviderConfig.findFirst({
    where: { enabled: true },
    orderBy: { updatedAt: 'desc' },
  });
  const socialProviders: SocialProviders = {};
  const oidcClients = env.OIDC_CLIENTS.map((client) => ({
    clientId: client.clientId,
    clientSecret: client.clientSecret,
    type: 'web' as const,
    name: client.name ?? 'OIDC Application',
    redirectURLs: [client.redirectUri],
    metadata: null,
    disabled: false,
    skipConsent: true,
  }));
  if (env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET && env.OIDC_REDIRECT_URI) {
    oidcClients.unshift({
      clientId: env.OIDC_CLIENT_ID,
      clientSecret: env.OIDC_CLIENT_SECRET,
      type: 'web' as const,
      name: env.OIDC_CLIENT_NAME,
      redirectURLs: [env.OIDC_REDIRECT_URI],
      metadata: null,
      disabled: false,
      skipConsent: true,
    });
  }
  if (configured) {
    try {
      const provider = {
        clientId: configured.clientId,
        clientSecret: decryptSecret(configured.clientSecretEncrypted),
        disableSignUp: true,
        prompt: 'select_account' as const,
      };
      if (configured.type === 'GOOGLE') {
        socialProviders.google = { ...provider, hd: configured.domainHint ?? undefined };
      } else if (configured.type === 'SLACK') {
        socialProviders.slack = provider;
      } else {
        socialProviders.microsoft = {
          ...provider,
          tenantId: configured.tenantId ?? 'common',
        };
      }
    } catch {
      // Keep existing sessions usable so an administrator can repair an undecryptable provider.
      console.error('Unable to decrypt active SSO provider configuration', { id: configured.id });
    }
  }

  return betterAuth({
    appName: 'Authy',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: prismaAdapter(db, { provider: 'postgresql' }),
    databaseHooks: {
      session: {
        create: {
          before: async (session, context) => {
            if (!configured || !context?.path.startsWith('/callback')) return;
            const membership = await db.membership.findUnique({
              where: {
                organizationId_userId: {
                  organizationId: configured.organizationId,
                  userId: session.userId,
                },
              },
              select: { id: true },
            });
            if (!membership) {
              throw new APIError('FORBIDDEN', {
                message: 'This SSO connection does not grant access to your organization.',
              });
            }
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 14,
      sendResetPassword: async ({ user, url }) => {
        const memberships = await db.membership.findMany({
          where: { userId: user.id },
          select: { organizationId: true },
          take: 2,
        });
        const { sendPasswordReset, sendSystemPasswordReset } =
          await import('@/modules/integrations/email');
        try {
          if (memberships.length === 1) {
            await sendPasswordReset({
              organizationId: memberships[0].organizationId,
              email: user.email,
              name: user.name,
              resetUrl: url,
            });
          } else {
            await sendSystemPasswordReset({ email: user.email, name: user.name, resetUrl: url });
          }
        } catch (error) {
          // Password-recovery responses must not reveal whether an account exists.
          console.error('[password-reset-email-failed]', {
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown delivery failure',
          });
        }
      },
    },
    socialProviders,
    plugins: [
      oidcProvider({
        loginPage: '/sign-in',
        requirePKCE: true,
        allowPlainCodeChallengeMethod: false,
        useJWTPlugin: true,
        trustedClients: oidcClients,
      }),
      jwt({ disableSettingJwtHeader: true }),
    ],
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google', 'microsoft', 'slack'],
        allowDifferentEmails: false,
      },
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path !== '/sign-in/email') return;
        const email = (context.body as { email?: unknown } | undefined)?.email;
        if (typeof email !== 'string') return;
        const membership = await db.membership.findFirst({
          where: { user: { email: { equals: email, mode: 'insensitive' } } },
          select: { organization: { select: { passwordLoginEnabled: true } } },
        });
        if (membership && !membership.organization.passwordLoginEnabled) {
          throw new APIError('FORBIDDEN', {
            message: 'Password sign-in is disabled. Use your organization SSO provider.',
          });
        }
      }),
      after: createAuthMiddleware(async (context) => {
        if (context.path !== '/change-password' || context.context.returned instanceof APIError) {
          return;
        }
        const userId = context.context.session?.user.id;
        if (!userId) return;
        await db.user.updateMany({
          where: { id: userId, mustChangePassword: true },
          data: { mustChangePassword: false, onboardingCompletedAt: null },
        });
      }),
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === 'production',
      cookiePrefix: 'authy',
    },
    trustedOrigins: [env.BETTER_AUTH_URL],
  });
}
