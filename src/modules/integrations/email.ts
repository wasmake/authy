import type { EmailTemplateType } from '@prisma/client';
import { Resend } from 'resend';

import { db } from '@/lib/db';
import { env } from '@/lib/env';
import {
  emailTemplateDefinitions,
  renderTemplate,
  sampleTemplateValues,
  type TemplateValues,
} from '@/modules/email/templates';
import { decryptSecret } from '@/modules/security/encryption';

type DeliveryInput = {
  organizationId: string;
  type: EmailTemplateType;
  to: string;
  values: TemplateValues;
  useDisabledConfiguration?: boolean;
};

export async function sendCredentials(input: {
  organizationId: string;
  email: string;
  name: string;
  temporaryPassword: string;
}): Promise<void> {
  await deliver({
    organizationId: input.organizationId,
    type: 'USER_CREDENTIALS',
    to: input.email,
    values: {
      recipientName: input.name,
      recipientEmail: input.email,
      temporaryPassword: input.temporaryPassword,
      signInUrl: `${env.BETTER_AUTH_URL}/sign-in`,
    },
  });
}

export async function sendPasswordReset(input: {
  organizationId: string;
  email: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  await deliver({
    organizationId: input.organizationId,
    type: 'PASSWORD_RESET',
    to: input.email,
    values: {
      recipientName: input.name,
      recipientEmail: input.email,
      resetUrl: input.resetUrl,
    },
  });
}

export async function sendSystemPasswordReset(input: {
  email: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  const type = 'PASSWORD_RESET';
  const rendered = renderTemplate(type, emailTemplateDefinitions[type], {
    organizationName: 'Authy',
    recipientName: input.name,
    recipientEmail: input.email,
    appUrl: env.BETTER_AUTH_URL,
    resetUrl: input.resetUrl,
  });
  await deliverWithEnvironment({
    type,
    to: input.email,
    values: { resetUrl: input.resetUrl },
    rendered,
  });
}

export async function sendInvitation(input: {
  organizationId: string;
  email: string;
  name: string;
  signInUrl: string;
}): Promise<void> {
  await deliver({
    organizationId: input.organizationId,
    type: 'INVITATION',
    to: input.email,
    values: {
      recipientName: input.name,
      recipientEmail: input.email,
      signInUrl: input.signInUrl,
    },
  });
}

export async function sendTestEmail(input: {
  organizationId: string;
  to: string;
  type: EmailTemplateType;
}): Promise<void> {
  await deliver({
    organizationId: input.organizationId,
    type: input.type,
    to: input.to,
    values: { ...sampleTemplateValues(), recipientEmail: input.to },
    useDisabledConfiguration: true,
  });
}

async function deliver(input: DeliveryInput): Promise<void> {
  const organization = await db.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: {
      name: true,
      emailProvider: true,
      emailTemplates: { where: { type: input.type }, select: { subject: true, html: true } },
    },
  });
  const definition = emailTemplateDefinitions[input.type];
  const template = organization.emailTemplates[0] ?? definition;
  const values = {
    ...input.values,
    organizationName: organization.name,
    appUrl: env.BETTER_AUTH_URL,
  };
  const rendered = renderTemplate(input.type, template, values);
  const configured = organization.emailProvider;

  if (configured) {
    if (configured.enabled || input.useDisabledConfiguration) {
      const resend = new Resend(decryptSecret(configured.resendApiKeyEncrypted));
      const result = await resend.emails.send({
        from: `${singleLine(configured.fromName)} <${configured.fromEmail}>`,
        to: input.to,
        replyTo: configured.replyTo ?? undefined,
        subject: rendered.subject,
        html: rendered.html,
      });
      if (result.error) {
        throw Object.assign(new Error(`Resend rejected the email: ${result.error.message}`), {
          statusCode: 400,
        });
      }
      return;
    }
    throw Object.assign(new Error('Email delivery is paused for this organization'), {
      statusCode: 400,
    });
  }

  if (input.useDisabledConfiguration) {
    throw Object.assign(new Error('Save a Resend API key before sending a test email'), {
      statusCode: 400,
    });
  }

  await deliverWithEnvironment({
    type: input.type,
    to: input.to,
    values: input.values,
    rendered,
  });
}

async function deliverWithEnvironment(input: {
  type: EmailTemplateType;
  to: string;
  values: TemplateValues;
  rendered: { subject: string; html: string };
}): Promise<void> {
  if (env.INTEGRATION_MODE === 'live') {
    if (!env.RESEND_API_KEY) {
      throw new Error('Installation email delivery is not configured');
    }
    const result = await new Resend(env.RESEND_API_KEY).emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.rendered.subject,
      html: input.rendered.html,
    });
    if (result.error) throw new Error(`Resend rejected the email: ${result.error.message}`);
    return;
  }

  const metadata: Record<string, string> = { recipient: input.to, type: input.type };
  if (input.type === 'USER_CREDENTIALS') {
    // Intentional local-only exception: expose mock credentials so local sign-in remains usable.
    metadata.temporaryPassword = input.values.temporaryPassword ?? '';
  } else if (input.type === 'PASSWORD_RESET') {
    metadata.resetUrl = input.values.resetUrl ?? '';
  } else {
    metadata.signInUrl = input.values.signInUrl ?? '';
  }
  console.info('[mock-email]', metadata);
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
