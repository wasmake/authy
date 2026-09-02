import { decryptSecret, encryptSecret } from '@/modules/security/encryption';
import { accessibleVaultWhere, vaultMetadataSelect } from '@/modules/vault/service';

describe('vault security invariants', () => {
  it('does not select encrypted values for metadata responses', () => {
    expect(vaultMetadataSelect).not.toHaveProperty('encryptedValue');
  });

  it('scopes member access through direct or group assignments', () => {
    const where = accessibleVaultWhere({
      userId: 'user-1',
      organizationId: 'org-1',
      organizationRole: 'MEMBER',
    });

    expect(where).toEqual({
      organizationId: 'org-1',
      assignments: {
        some: {
          OR: [{ userId: 'user-1' }, { group: { members: { some: { userId: 'user-1' } } } }],
        },
      },
    });
  });

  it('allows administrators to query all items only within their tenant', () => {
    expect(
      accessibleVaultWhere({
        userId: 'admin-1',
        organizationId: 'org-1',
        organizationRole: 'ADMIN',
      }),
    ).toEqual({ organizationId: 'org-1' });
  });

  it('round-trips protected values without embedding plaintext in ciphertext', () => {
    const plaintext = 'production-secret-value';
    const encrypted = encryptSecret(plaintext);

    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });
});
