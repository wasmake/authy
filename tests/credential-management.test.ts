import { canRegenerateCredentials } from '@/modules/users/credential-management';

describe('credential management policy', () => {
  it.each([
    [true, true, 1, true],
    [true, false, 1, false],
    [true, true, 2, false],
    [false, true, 1, false],
  ] as const)(
    'maps password=%s credential=%s memberships=%s to %s',
    (passwordLoginEnabled, hasCredentialAccount, membershipCount, expected) => {
      expect(
        canRegenerateCredentials({
          passwordLoginEnabled,
          hasCredentialAccount,
          membershipCount,
        }),
      ).toBe(expected);
    },
  );
});
