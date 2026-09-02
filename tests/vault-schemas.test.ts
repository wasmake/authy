import { createVaultItemSchema, updateVaultItemSchema } from '@/modules/vault/schemas';

describe('vault validation', () => {
  it('requires the secret field appropriate for each vault item type', () => {
    expect(() =>
      createVaultItemSchema.parse({
        name: 'Production login',
        type: 'CREDENTIAL',
        username: 'deploy@example.com',
      }),
    ).toThrow();
    expect(() =>
      createVaultItemSchema.parse({ name: 'Signing key', type: 'SECRET', content: 'wrong' }),
    ).toThrow();
    expect(
      createVaultItemSchema.parse({
        name: 'Production environment',
        type: 'ENVIRONMENT',
        content: 'HOST=example.com',
      }),
    ).toMatchObject({ userIds: [], groupIds: [] });
  });

  it('deduplicates assignment replacements and allows an unchanged encrypted value', () => {
    expect(
      updateVaultItemSchema.parse({
        name: 'Signing key',
        type: 'SECRET',
        userIds: ['user-1', 'user-1'],
        groupIds: ['group-1'],
      }),
    ).toEqual({
      name: 'Signing key',
      type: 'SECRET',
      userIds: ['user-1'],
      groupIds: ['group-1'],
    });
  });

  it('rejects fields belonging to another item type', () => {
    expect(() =>
      createVaultItemSchema.parse({
        name: 'API key',
        type: 'SECRET',
        value: 'secret',
        password: 'also-secret',
      }),
    ).toThrow();
  });
});
