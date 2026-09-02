import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  OIDC_CLIENT_ID: z.string().min(1).optional(),
  OIDC_CLIENT_SECRET: z.string().min(32).optional(),
  OIDC_REDIRECT_URI: z.string().url().optional(),
  OIDC_CLIENT_LAUNCH_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Authy <noreply@example.test>'),
  INTEGRATION_MODE: z.enum(['mock', 'live']).default('mock'),
});

export const env = schema.parse(process.env);
