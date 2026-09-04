export function canRegenerateCredentials(input: {
  passwordLoginEnabled: boolean;
  hasCredentialAccount: boolean;
  membershipCount: number;
}): boolean {
  return input.passwordLoginEnabled && input.hasCredentialAccount && input.membershipCount === 1;
}
