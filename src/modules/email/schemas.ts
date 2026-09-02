import { EmailTemplateType } from '@prisma/client';
import { z } from 'zod';

export const emailProviderSchema = z
  .object({
    resendApiKey: z.string().trim().min(10).max(500).optional(),
    fromName: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[^\r\n<>]+$/, 'From name cannot contain line breaks or angle brackets'),
    fromEmail: z.string().trim().email().max(320),
    replyTo: z.union([z.string().trim().email().max(320), z.literal('')]).optional(),
    enabled: z.boolean(),
  })
  .strict();

export const emailTemplateSchema = z
  .object({
    subject: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[^\r\n]+$/, 'Subject must be one line'),
    html: z.string().trim().min(1).max(200_000),
  })
  .strict();

export const emailTemplateTypeSchema = z.nativeEnum(EmailTemplateType);

export const testEmailSchema = z
  .object({
    to: z.string().trim().email().max(320),
    type: emailTemplateTypeSchema,
  })
  .strict();
