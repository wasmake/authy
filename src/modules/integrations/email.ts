import { Resend } from 'resend';

import { env } from '@/lib/env';

export interface EmailAdapter {
  sendInvitation(email: string, organization: string, url: string): Promise<void>;
  sendPasswordReset(email: string, name: string, url: string): Promise<void>;
  sendCredentials(
    email: string,
    name: string,
    organization: string,
    temporaryPassword: string,
  ): Promise<void>;
}

class MockEmailAdapter implements EmailAdapter {
  async sendInvitation(email: string, organization: string, url: string) {
    console.info('[mock-email] invitation', { email, organization, url });
  }
  async sendPasswordReset(email: string, name: string, url: string) {
    console.info('[mock-email] password-reset', { email, name, url });
  }
  async sendCredentials(
    email: string,
    _name: string,
    _organization: string,
    temporaryPassword: string,
  ) {
    // Intentional local-only exception: expose mock credentials so local sign-in remains usable.
    console.info('[mock-email] credentials', { recipient: email, temporaryPassword });
  }
}

class ResendEmailAdapter implements EmailAdapter {
  private readonly client = new Resend(env.RESEND_API_KEY);
  async sendInvitation(email: string, organization: string, url: string) {
    await this.client.emails.send({
      from: env.EMAIL_FROM,
      to: email,
      subject: `Join ${organization} on Authy`,
      html: `<h1>You're invited</h1><p><a href="${url}">Accept invitation</a></p>`,
    });
  }
  async sendPasswordReset(email: string, name: string, url: string) {
    await this.client.emails.send({
      from: env.EMAIL_FROM,
      to: email,
      subject: 'Reset your Authy password',
      html: `<p>Hello ${name},</p><p><a href="${url}">Reset password</a></p>`,
    });
  }
  async sendCredentials(
    email: string,
    name: string,
    organization: string,
    temporaryPassword: string,
  ) {
    await this.client.emails.send({
      from: env.EMAIL_FROM,
      to: email,
      subject: `Your ${organization} Authy credentials`,
      text: [
        `Hello ${name},`,
        '',
        `An account has been created for you in ${organization}.`,
        `Sign in: ${env.BETTER_AUTH_URL}/sign-in`,
        `Email: ${email}`,
        `Temporary password: ${temporaryPassword}`,
        '',
        'Sign in and change this temporary password immediately.',
      ].join('\n'),
    });
  }
}

export const emailAdapter: EmailAdapter =
  env.INTEGRATION_MODE === 'live' && env.RESEND_API_KEY
    ? new ResendEmailAdapter()
    : new MockEmailAdapter();
