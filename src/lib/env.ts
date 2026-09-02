import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Authy <noreply@example.test>'),
  INTEGRATION_MODE: z.enum(['mock', 'live']).default('mock'),
});

export const env = schema.parse(process.env);
