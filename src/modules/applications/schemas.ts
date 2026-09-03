import { z } from 'zod';

const httpUrl = z
  .string()
  .url()
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
    message: 'Must use the http or https protocol',
  });

export const applicationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  type: z.enum(['OIDC', 'SAML', 'LINK', 'LOCAL']),
  launchUrl: httpUrl.optional(),
  redirectUris: z.array(httpUrl).max(20).default([]),
  scopes: z
    .array(z.string().regex(/^[a-z][a-z0-9:_-]*$/))
    .max(30)
    .default(['openid', 'profile', 'email']),
  isPublished: z.boolean().default(false),
});

export const applicationUpdateSchema = z
  .object({
    name: applicationSchema.shape.name.optional(),
    description: applicationSchema.shape.description,
    launchUrl: applicationSchema.shape.launchUrl,
    redirectUris: applicationSchema.shape.redirectUris.removeDefault().optional(),
    scopes: applicationSchema.shape.scopes.removeDefault().optional(),
    isPublished: applicationSchema.shape.isPublished.removeDefault().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

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
