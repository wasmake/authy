import { meetsPasswordPolicy, passwordRequirementResults } from '@/modules/users/password-policy';

describe('password policy', () => {
  it('requires at least 14 characters with upper, lower, number, and symbol characters', () => {
    expect(meetsPasswordPolicy('CorrectHorse1!')).toBe(true);
    expect(meetsPasswordPolicy('Short1!')).toBe(false);
    expect(meetsPasswordPolicy('lowercaseonly1!')).toBe(false);
    expect(meetsPasswordPolicy('UPPERCASEONLY1!')).toBe(false);
    expect(meetsPasswordPolicy('NoNumbersHere!!')).toBe(false);
    expect(meetsPasswordPolicy('NoSymbolsHere12')).toBe(false);
  });

  it('reports each requirement independently for the animated helper', () => {
    expect(passwordRequirementResults('lowercase-only')).toEqual([
      { key: 'length', label: '14 or more characters', met: true },
      { key: 'uppercase', label: 'Uppercase letter', met: false },
      { key: 'lowercase', label: 'Lowercase letter', met: true },
      { key: 'number', label: 'Number', met: false },
      { key: 'symbol', label: 'Symbol', met: true },
    ]);
  });

  it('rejects passwords longer than the supported credential limit', () => {
    expect(meetsPasswordPolicy(`Aa1!${'x'.repeat(125)}`)).toBe(false);
  });
});
