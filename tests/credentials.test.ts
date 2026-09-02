import { createCredential, verifyCredential } from '@/modules/security/credentials';
describe('service credentials', () => {
  it('only validates the generated secret', () => {
    const value = createCredential();
    expect(value.secret).toContain(`${value.prefix}.`);
    expect(verifyCredential(value.secret, value.secretHash)).toBe(true);
    expect(verifyCredential(`${value.secret}x`, value.secretHash)).toBe(false);
  });
});
