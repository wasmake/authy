import { z } from 'zod';

const assignmentIds = z
  .array(z.string().trim().min(1))
  .max(200)
  .transform((ids) => [...new Set(ids)]);

const details = {
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  userIds: assignmentIds.default([]),
  groupIds: assignmentIds.default([]),
};

const secretValue = z.string().min(1).max(1_000_000);

export const createVaultItemSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...details,
      type: z.literal('CREDENTIAL'),
      username: z.string().trim().min(1).max(320),
      password: secretValue,
    })
    .strict(),
  z
    .object({
      ...details,
      type: z.literal('SECRET'),
      value: secretValue,
    })
    .strict(),
  z
    .object({
      ...details,
      type: z.literal('ENVIRONMENT'),
      content: secretValue,
    })
    .strict(),
]);

export const updateVaultItemSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...details,
      type: z.literal('CREDENTIAL'),
      username: z.string().trim().min(1).max(320),
      password: secretValue.optional(),
    })
    .strict(),
  z
    .object({
      ...details,
      type: z.literal('SECRET'),
      value: secretValue.optional(),
    })
    .strict(),
  z
    .object({
      ...details,
      type: z.literal('ENVIRONMENT'),
      content: secretValue.optional(),
    })
    .strict(),
]);

export type CreateVaultItemInput = z.infer<typeof createVaultItemSchema>;
export type UpdateVaultItemInput = z.infer<typeof updateVaultItemSchema>;
