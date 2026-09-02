import { z } from 'zod';

export const applicationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  type: z.enum(['OIDC', 'SAML', 'LINK', 'LOCAL']),
  launchUrl: z.string().url().optional(),
  redirectUris: z.array(z.string().url()).max(20).default([]),
  scopes: z
    .array(z.string().regex(/^[a-z][a-z0-9:_-]*$/))
    .max(30)
    .default(['openid', 'profile', 'email']),
  isPublished: z.boolean().default(false),
});

export const assignmentSchema = z
  .object({
    userId: z.string().cuid().optional(),
    groupId: z.string().cuid().optional(),
    entitlements: z.array(z.string().min(1).max(100)).max(50).default([]),
  })
  .refine(
    (value) => Boolean(value.userId) !== Boolean(value.groupId),
    'Exactly one userId or groupId is required',
  );

export const accessRequestSchema = z.object({
  applicationId: z.string().min(1),
  reason: z.string().trim().min(5).max(500),
});
export const decisionSchema = z.object({
  status: z.enum(['APPROVED', 'DENIED']),
  note: z.string().trim().max(500).optional(),
});
