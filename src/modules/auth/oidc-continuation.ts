type QueryValue = string | string[] | undefined;

const REQUIRED_OIDC_QUERY_PARAMETERS = [
  'client_id',
  'redirect_uri',
  'response_type',
  'scope',
  'code_challenge',
  'code_challenge_method',
  'state',
] as const;

export function getOidcContinuation(query: Record<string, QueryValue>): string | null {
  const required = Object.fromEntries(
    REQUIRED_OIDC_QUERY_PARAMETERS.map((key) => [key, query[key]]),
  );
  if (
    Object.values(required).some((value) => typeof value !== 'string' || !value) ||
    required.response_type !== 'code' ||
    required.code_challenge_method !== 'S256'
  ) {
    return null;
  }

  const parameters = new URLSearchParams();
  for (const key of REQUIRED_OIDC_QUERY_PARAMETERS) {
    parameters.set(key, required[key] as string);
  }
  if (typeof query.nonce === 'string' && query.nonce) parameters.set('nonce', query.nonce);
  return `/api/auth/oauth2/authorize?${parameters.toString()}`;
}

export function parseOidcContinuation(value: QueryValue): string | null {
  if (typeof value !== 'string' || !value.startsWith('/api/auth/oauth2/authorize?')) return null;
  const url = new URL(value, 'https://authy.invalid');
  if (url.origin !== 'https://authy.invalid' || url.pathname !== '/api/auth/oauth2/authorize') {
    return null;
  }
  return getOidcContinuation(Object.fromEntries(url.searchParams));
}
