export const PASSWORD_REQUIREMENTS = [
  {
    key: 'length',
    label: '14 or more characters',
    test: (password: string) => password.length >= 14,
  },
  {
    key: 'uppercase',
    label: 'Uppercase letter',
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    key: 'lowercase',
    label: 'Lowercase letter',
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    key: 'number',
    label: 'Number',
    test: (password: string) => /[0-9]/.test(password),
  },
  {
    key: 'symbol',
    label: 'Symbol',
    test: (password: string) => /[^A-Za-z0-9]/.test(password),
  },
] as const;

export function passwordRequirementResults(password: string) {
  return PASSWORD_REQUIREMENTS.map((requirement) => ({
    key: requirement.key,
    label: requirement.label,
    met: requirement.test(password),
  }));
}

export function meetsPasswordPolicy(password: string): boolean {
  return (
    password.length <= 128 &&
    PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password))
  );
}
