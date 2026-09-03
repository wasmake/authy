import { getOidcContinuation } from '@/modules/auth/oidc-continuation';

const validQuery = {
  client_id: 'docmost-production',
  redirect_uri: 'https://docs.example.com/api/auth/oidc/callback',
  response_type: 'code',
  scope: 'openid profile email',
  code_challenge: 'challenge',
  code_challenge_method: 'S256',
  state: 'state',
  nonce: 'nonce',
};

describe('OIDC sign-in continuation', () => {
  it('rebuilds the authorization request after authentication', () => {
    const continuation = getOidcContinuation(validQuery);
    const url = new URL(continuation!, 'https://auth.example.com');

    expect(url.pathname).toBe('/api/auth/oauth2/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual(validQuery);
  });

  it('rejects incomplete authorization requests', () => {
    expect(getOidcContinuation({ ...validQuery, code_challenge: undefined })).toBeNull();
  });

  it('rejects non-code and non-S256 requests', () => {
    expect(getOidcContinuation({ ...validQuery, response_type: 'token' })).toBeNull();
    expect(getOidcContinuation({ ...validQuery, code_challenge_method: 'plain' })).toBeNull();
  });
});
