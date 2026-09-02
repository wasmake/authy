import { emailProviderSchema } from '@/modules/email/schemas';
import {
  emailTemplateDefinitions,
  renderTemplate,
  sanitizeTemplate,
  validateTemplatePlaceholders,
} from '@/modules/email/templates';

describe('email templates', () => {
  it('keeps allowed URL placeholders in sanitized defaults', () => {
    const template = emailTemplateDefinitions.PASSWORD_RESET;
    const sanitized = sanitizeTemplate(template.type, template.html);

    expect(sanitized).toContain('href="{{resetUrl}}"');
    expect(sanitized).toContain('{{recipientName}}');
  });

  it('keeps URL placeholders that include optional whitespace', () => {
    const sanitized = sanitizeTemplate(
      'PASSWORD_RESET',
      '<a href="{{ resetUrl }}">Reset password</a>',
    );

    expect(sanitized).toContain('href="{{resetUrl}}"');
  });

  it('rejects placeholders that are not available to a template', () => {
    expect(() =>
      validateTemplatePlaceholders('PASSWORD_RESET', 'Reset {{temporaryPassword}}', '<p>Hello</p>'),
    ).toThrow('Unknown or malformed placeholder');
  });

  it('removes executable markup and unsafe links', () => {
    const sanitized = sanitizeTemplate(
      'INVITATION',
      '<script>alert(1)</script><p onclick="alert(1)">Hello</p><a href="javascript:alert(1)">Open</a><a href="{{signInUrl}}">Sign in</a>',
    );

    expect(sanitized).toBe('<p>Hello</p><a>Open</a><a href="{{signInUrl}}">Sign in</a>');
  });

  it('requires the action secret and prevents embedding it in another URL', () => {
    expect(() =>
      sanitizeTemplate('PASSWORD_RESET', '<p>Contact support to reset your password.</p>'),
    ).toThrow('must include {{resetUrl}}');

    expect(() =>
      sanitizeTemplate(
        'PASSWORD_RESET',
        '<a href="https://attacker.example/collect?url={{resetUrl}}">Reset password</a>',
      ),
    ).toThrow('must be the complete href value');

    expect(() =>
      sanitizeTemplate('PASSWORD_RESET', '<div href="{{resetUrl}}">Reset password</div>'),
    ).toThrow('must be the complete href value');

    expect(() => sanitizeTemplate('PASSWORD_RESET', '<p>href="{{resetUrl}}"</p>')).toThrow(
      'must be the complete href value',
    );

    expect(() =>
      sanitizeTemplate('PASSWORD_RESET', '<!-- href="{{resetUrl}}" --><p>Reset password</p>'),
    ).toThrow('must be the complete href value');
  });

  it('rejects malformed placeholder-like values', () => {
    expect(() =>
      sanitizeTemplate(
        'USER_CREDENTIALS',
        '<p>{{temporary-password}}</p><a href="{{signInUrl}}">Sign in</a>',
      ),
    ).toThrow('Unknown or malformed placeholder');
  });

  it('escapes placeholder values while preserving generated secure links', () => {
    const rendered = renderTemplate(
      'PASSWORD_RESET',
      {
        subject: 'Reset for {{recipientName}}',
        html: '<p>Hello {{recipientName}}</p><a href="{{resetUrl}}">Reset</a>',
      },
      {
        recipientName: '<img src=x onerror=alert(1)>',
        resetUrl: 'https://auth.example/reset?token=a&mode=secure',
      },
    );

    expect(rendered.subject).toBe('Reset for <img src=x onerror=alert(1)>');
    expect(rendered.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(rendered.html).toContain('href="https://auth.example/reset?token=a&amp;mode=secure"');
    expect(rendered.html).not.toContain('<img');
  });

  it('validates organization sender settings', () => {
    expect(
      emailProviderSchema.parse({
        resendApiKey: 're_example-key',
        fromName: 'Northstar Security',
        fromEmail: 'security@northstar.example',
        replyTo: '',
        enabled: true,
      }),
    ).toMatchObject({ fromEmail: 'security@northstar.example', enabled: true });

    expect(() =>
      emailProviderSchema.parse({
        resendApiKey: 're_example-key',
        fromName: 'Security <spoofed@example.com>',
        fromEmail: 'security@northstar.example',
        enabled: true,
      }),
    ).toThrow();
  });
});
