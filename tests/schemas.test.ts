import {
  accessRequestSchema,
  applicationSchema,
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
