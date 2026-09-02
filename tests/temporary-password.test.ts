import { generateTemporaryPassword } from '@/modules/users/temporary-password';

describe('temporary passwords', () => {
  it('generates memorable credentials with random words, a number, and a symbol', () => {
    const password = generateTemporaryPassword();

    expect(password).toMatch(/^[a-z]+(?:-[a-z]+){4}-\d{6}[!@#$%&*?]$/);
  });
});
