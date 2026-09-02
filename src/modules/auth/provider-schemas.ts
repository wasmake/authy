import { z } from 'zod';

export const providerSchema = z
  .object({
    type: z.enum(['GOOGLE', 'MICROSOFT', 'SLACK', 'ACTIVE_DIRECTORY']),
    displayName: z.string().trim().min(2).max(60),
    clientId: z.string().trim().min(3).max(500),
    clientSecret: z.string().min(8).max(2000).optional(),
    tenantId: z.string().trim().max(200).optional(),
    domainHint: z.string().trim().max(255).optional(),
    enabled: z.boolean().default(false),
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.type === 'MICROSOFT' || input.type === 'ACTIVE_DIRECTORY') && !input.tenantId) {
      context.addIssue({
        code: 'custom',
        path: ['tenantId'],
        message: 'Microsoft tenant ID is required',
      });
    }
  });
