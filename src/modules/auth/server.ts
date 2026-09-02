import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

import { db } from '@/lib/db';
import { env } from '@/lib/env';

export const auth = betterAuth({
  appName: 'Authy',
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    sendResetPassword: async ({ user, url }) => {
      const { emailAdapter } = await import('@/modules/integrations/email');
      await emailAdapter.sendPasswordReset(user.email, user.name, url);
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    cookiePrefix: 'authy',
  },
  trustedOrigins: [env.BETTER_AUTH_URL],
});
