import {
  accessRequestSchema,
  applicationSchema,
  applicationUpdateSchema,
  assignmentSchema,
} from '@/modules/applications/schemas';
describe('application validation', () => {
  it('rejects unsafe launch URLs and malformed scopes', () => {
    expect(() =>
      applicationSchema.parse({
        name: 'App',
        type: 'OIDC',
        launchUrl: 'javascript:alert(1)',
        scopes: ['bad scope'],
      }),
    ).toThrow();
    expect(() =>
      applicationUpdateSchema.parse({ redirectUris: ['file:///tmp/callback'] }),
    ).toThrow();
  });
  it('accepts metadata and visibility updates for published applications', () => {
    expect(
      applicationUpdateSchema.parse({
        name: 'Updated app',
        description: 'Updated after publication',
        launchUrl: 'https://app.example.com',
        redirectUris: ['https://app.example.com/auth/callback'],
        scopes: ['openid', 'email'],
        isPublished: true,
      }),
    ).toEqual({
      name: 'Updated app',
      description: 'Updated after publication',
      launchUrl: 'https://app.example.com',
      redirectUris: ['https://app.example.com/auth/callback'],
      scopes: ['openid', 'email'],
      isPublished: true,
    });
  });
  it('rejects empty updates and protected fields', () => {
    expect(() => applicationUpdateSchema.parse({})).toThrow();
    expect(() => applicationUpdateSchema.parse({ clientId: 'replacement' })).toThrow();
    expect(() => applicationUpdateSchema.parse({ type: 'LINK' })).toThrow();
  });
  it('requires exactly one assignment principal', () => {
    expect(() => assignmentSchema.parse({ entitlements: [] })).toThrow();
    expect(() =>
      assignmentSchema.parse({
        userId: 'cm1234567890123456789012',
        groupId: 'cm1234567890123456789013',
      }),
    ).toThrow();
  });
  it('requires meaningful request reasons', () => {
    expect(() =>
      accessRequestSchema.parse({ applicationId: 'cm1234567890123456789012', reason: 'x' }),
    ).toThrow();
  });
});
