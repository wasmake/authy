import { providerSchema } from '@/modules/auth/provider-schemas';

const provider = {
  type: 'GOOGLE' as const,
  displayName: 'Google Workspace',
  clientId: 'google-client-id',
  clientSecret: 'google-client-secret',
  enabled: true,
};

describe('authentication provider configuration', () => {
  it('accepts a valid Google provider', () => {
    expect(providerSchema.parse(provider)).toMatchObject(provider);
  });

  it('requires a tenant for Microsoft-backed providers', () => {
    expect(() => providerSchema.parse({ ...provider, type: 'ACTIVE_DIRECTORY' })).toThrow(
      'Microsoft tenant ID is required',
    );
  });

  it('rejects unexpected configuration fields', () => {
    expect(() => providerSchema.parse({ ...provider, clientSecretEncrypted: 'leak' })).toThrow();
  });
});
