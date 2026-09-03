import { z } from 'zod';

import { parseOidcClients } from '@/lib/oidc-clients';

const optionalString = (schema: z.ZodString) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    OIDC_CLIENT_ID: optionalString(z.string().min(1)),
    OIDC_CLIENT_SECRET: optionalString(z.string().min(32)),
    OIDC_REDIRECT_URI: optionalString(z.string().url()),
    OIDC_CLIENT_NAME: z.string().min(1).default('OIDC Application'),
    OIDC_CLIENT_DESCRIPTION: optionalString(z.string().max(500)),
    OIDC_CLIENT_LAUNCH_URL: optionalString(z.string().url()),
    OIDC_CLIENTS_JSON: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default('Authy <noreply@example.test>'),
    INTEGRATION_MODE: z.enum(['mock', 'live']).default('mock'),
  })
  .superRefine((value, context) => {
    const legacyValues = [value.OIDC_CLIENT_ID, value.OIDC_CLIENT_SECRET, value.OIDC_REDIRECT_URI];
    if (legacyValues.some(Boolean) && !legacyValues.every(Boolean)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and OIDC_REDIRECT_URI must be configured together',
        path: ['OIDC_CLIENT_ID'],
      });
    }
  });

const parsedEnv = schema.parse(process.env);

export const env = {
  ...parsedEnv,
  OIDC_CLIENTS: parseOidcClients(parsedEnv.OIDC_CLIENTS_JSON, parsedEnv.OIDC_CLIENT_ID),
};
