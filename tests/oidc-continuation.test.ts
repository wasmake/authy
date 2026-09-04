import { getOidcContinuation, parseOidcContinuation } from '@/modules/auth/oidc-continuation';

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

  it('preserves valid PKCE requests that omit the optional nonce', () => {
    const continuation = getOidcContinuation({ ...validQuery, nonce: undefined });
    const url = new URL(continuation!, 'https://auth.example.com');

    expect(url.searchParams.get('client_id')).toBe(validQuery.client_id);
    expect(url.searchParams.has('nonce')).toBe(false);
  });

  it('rejects non-code and non-S256 requests', () => {
    expect(getOidcContinuation({ ...validQuery, response_type: 'token' })).toBeNull();
    expect(getOidcContinuation({ ...validQuery, code_challenge_method: 'plain' })).toBeNull();
  });

  it('accepts only validated internal authorization continuations', () => {
    const continuation = getOidcContinuation(validQuery)!;
    expect(parseOidcContinuation(continuation)).toBe(continuation);
    expect(parseOidcContinuation('https://attacker.example/steal')).toBeNull();
    expect(parseOidcContinuation('/marketplace')).toBeNull();
  });
});
