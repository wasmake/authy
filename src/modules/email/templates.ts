import type { EmailTemplateType } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';

export type TemplateValues = Record<string, string>;

export type EmailTemplateDefinition = {
  type: EmailTemplateType;
  label: string;
  description: string;
  subject: string;
  html: string;
  placeholders: readonly string[];
};

const commonPlaceholders = [
  'organizationName',
  'recipientName',
  'recipientEmail',
  'appUrl',
] as const;

export const emailTemplateDefinitions: Record<EmailTemplateType, EmailTemplateDefinition> = {
  USER_CREDENTIALS: {
    type: 'USER_CREDENTIALS',
    label: 'New user credentials',
    description: 'Sent when an administrator creates a new password-based account.',
    subject: 'Your {{organizationName}} sign-in credentials',
    placeholders: [...commonPlaceholders, 'signInUrl', 'temporaryPassword'],
    html: `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6;max-width:620px;margin:0 auto">
  <p style="font-size:14px;color:#6b7280">{{organizationName}}</p>
  <h1 style="font-size:28px;line-height:1.2">Your account is ready</h1>
  <p>Hello {{recipientName}},</p>
  <p>An account has been created for you. Use the temporary credentials below to sign in.</p>
  <div style="background-color:#f4f3ff;border-radius:12px;padding:18px;margin:24px 0">
    <p style="margin:0 0 8px"><strong>Email</strong><br>{{recipientEmail}}</p>
    <p style="margin:0"><strong>Temporary password</strong><br><code>{{temporaryPassword}}</code></p>
  </div>
  <p><a href="{{signInUrl}}" style="background-color:#6d5ce7;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">Sign in securely</a></p>
  <p style="font-size:13px;color:#6b7280">You will be required to replace this password the first time you sign in.</p>
</div>`,
  },
  PASSWORD_RESET: {
    type: 'PASSWORD_RESET',
    label: 'Password reset',
    description: 'Sent after a user requests a password reset link.',
    subject: 'Reset your {{organizationName}} password',
    placeholders: [...commonPlaceholders, 'resetUrl'],
    html: `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6;max-width:620px;margin:0 auto">
  <p style="font-size:14px;color:#6b7280">{{organizationName}}</p>
  <h1 style="font-size:28px;line-height:1.2">Reset your password</h1>
  <p>Hello {{recipientName}},</p>
  <p>We received a request to reset your password. Use the secure link below to continue.</p>
  <p><a href="{{resetUrl}}" style="background-color:#6d5ce7;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">Reset password</a></p>
  <p style="font-size:13px;color:#6b7280">If you did not request this change, you can safely ignore this email.</p>
</div>`,
  },
  INVITATION: {
    type: 'INVITATION',
    label: 'Organization invitation',
    description: 'Sent when an existing identity is added to an organization.',
    subject: 'You have been added to {{organizationName}}',
    placeholders: [...commonPlaceholders, 'signInUrl'],
    html: `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6;max-width:620px;margin:0 auto">
  <p style="font-size:14px;color:#6b7280">{{organizationName}}</p>
  <h1 style="font-size:28px;line-height:1.2">Your access is ready</h1>
  <p>Hello {{recipientName}},</p>
  <p>You have been added to {{organizationName}} and can now access its assigned applications.</p>
  <p><a href="{{signInUrl}}" style="background-color:#6d5ce7;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">Sign in</a></p>
</div>`,
  },
};

const placeholderPattern = /{{\s*([A-Za-z][A-Za-z0-9]*)\s*}}/g;
const urlPlaceholders = ['appUrl', 'signInUrl', 'resetUrl'] as const;
const requiredPlaceholders: Record<EmailTemplateType, string> = {
  USER_CREDENTIALS: 'temporaryPassword',
  PASSWORD_RESET: 'resetUrl',
  INVITATION: 'signInUrl',
};

export function validateTemplatePlaceholders(
  type: EmailTemplateType,
  subject: string,
  html: string,
): void {
  const allowed = new Set(emailTemplateDefinitions[type].placeholders);
  const content = `${subject}\n${html}`;
  const rawTokens = [...content.matchAll(/{{[^{}]*}}/g)];
  const malformed = content.replace(/{{[^{}]*}}/g, '').includes('{{');
  if (malformed || content.replace(/{{[^{}]*}}/g, '').includes('}}')) {
    throw Object.assign(new Error('Malformed placeholder'), { statusCode: 400 });
  }
  const invalidToken = rawTokens.find((match) => {
    const placeholder = match[0].match(/^{{\s*([A-Za-z][A-Za-z0-9]*)\s*}}$/)?.[1];
    return !placeholder || !allowed.has(placeholder);
  });
  if (invalidToken) {
    throw Object.assign(new Error(`Unknown or malformed placeholder: ${invalidToken[0]}`), {
      statusCode: 400,
    });
  }

  const linkedUrls = new Set<string>();
  const htmlWithoutLinkedUrls = html.replace(
    /<a\b([^>]*?)href\s*=\s*(["'])\s*{{\s*(appUrl|signInUrl|resetUrl)\s*}}\s*\2/gi,
    (attribute, beforeHref: string, quote: string, placeholder: string) => {
      linkedUrls.add(placeholder);
      return `<a${beforeHref}href=${quote}https://placeholder.invalid/${placeholder}${quote}`;
    },
  );
  const misplacedUrl = [...`${subject}\n${htmlWithoutLinkedUrls}`.matchAll(placeholderPattern)]
    .map((match) => match[1])
    .find((placeholder) =>
      urlPlaceholders.includes(placeholder as (typeof urlPlaceholders)[number]),
    );
  if (misplacedUrl) {
    throw Object.assign(
      new Error(`{{${misplacedUrl}}} must be the complete href value of a link`),
      { statusCode: 400 },
    );
  }

  const required = requiredPlaceholders[type];
  const hasRequired = urlPlaceholders.includes(required as (typeof urlPlaceholders)[number])
    ? linkedUrls.has(required)
    : [...html.matchAll(placeholderPattern)].some((match) => match[1] === required);
  if (!hasRequired) {
    throw Object.assign(new Error(`Template content must include {{${required}}}`), {
      statusCode: 400,
    });
  }
}

export function sanitizeTemplate(type: EmailTemplateType, html: string): string {
  validateTemplatePlaceholders(type, '', html);
  const tokenized = html.replace(placeholderPattern, (token, placeholder: string) =>
    urlPlaceholders.includes(placeholder as (typeof urlPlaceholders)[number])
      ? `https://placeholder.invalid/${placeholder}`
      : token,
  );
  const sanitized = urlPlaceholders.reduce(
    (value, placeholder) =>
      value.replaceAll(`https://placeholder.invalid/${placeholder}`, `{{${placeholder}}}`),
    cleanHtml(tokenized),
  );
  validateTemplatePlaceholders(type, '', sanitized);
  return sanitized;
}

function cleanHtml(html: string): string {
  const spacing = /^(?:(?:auto|0|\d+(?:\.\d+)?(?:px|rem|em|%))(?:\s+|$)){1,4}$/;
  return sanitizeHtml(html, {
    allowedTags: [
      'a',
      'b',
      'blockquote',
      'br',
      'code',
      'div',
      'em',
      'h1',
      'h2',
      'h3',
      'hr',
      'i',
      'li',
      'ol',
      'p',
      'pre',
      'span',
      'strong',
      'table',
      'tbody',
      'td',
      'th',
      'thead',
      'tr',
      'u',
      'ul',
    ],
    allowedAttributes: {
      '*': ['style'],
      a: ['href', 'target'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i],
        'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i],
        'border-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i],
        'border-radius': [/^\d+(?:\.\d+)?(?:px|rem|%)$/],
        'font-family': [/^[\w\s,'"-]+$/],
        'font-size': [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
        'font-weight': [/^(?:normal|bold|[1-9]00)$/],
        'line-height': [/^\d+(?:\.\d+)?(?:px|rem|em|%)?$/],
        'text-align': [/^(?:left|right|center|justify)$/],
        'text-decoration': [/^(?:none|underline|line-through)$/],
        display: [/^(?:block|inline|inline-block|table|table-row|table-cell)$/],
        margin: [spacing],
        padding: [spacing],
        width: [/^(?:auto|\d+(?:\.\d+)?(?:px|rem|em|%))$/],
        'max-width': [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
      },
    },
  });
}

export function renderTemplate(
  type: EmailTemplateType,
  template: { subject: string; html: string },
  values: TemplateValues,
): { subject: string; html: string } {
  validateTemplatePlaceholders(type, template.subject, template.html);
  const replace = (value: string, escape: boolean) =>
    value.replace(placeholderPattern, (_, placeholder: string) => {
      const replacement = values[placeholder] ?? '';
      return escape ? escapeHtml(replacement) : replacement;
    });
  return {
    subject: replace(template.subject, false)
      .replace(/[\r\n]+/g, ' ')
      .trim(),
    html: cleanHtml(replace(template.html, true)),
  };
}

export function sampleTemplateValues(): TemplateValues {
  return {
    organizationName: 'Northstar Labs',
    recipientName: 'Jordan Lee',
    recipientEmail: 'jordan@example.com',
    appUrl: 'https://auth.example.com',
    signInUrl: 'https://auth.example.com/sign-in',
    temporaryPassword: 'harbor-orbit-maple-482917!',
    resetUrl: 'https://auth.example.com/reset-password?token=sample',
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
