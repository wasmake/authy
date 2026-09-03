import { parseOidcClients } from '@/lib/oidc-clients';

const client = {
  clientId: 'reporting',
  clientSecret: 'a'.repeat(32),
  redirectUri: 'https://reports.example.com/auth/callback',
};

describe('OIDC client environment configuration', () => {
  it('parses valid additional confidential clients', () => {
    expect(parseOidcClients(JSON.stringify([{ ...client, name: 'Reporting' }]))).toEqual([
      { ...client, name: 'Reporting' },
    ]);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseOidcClients('[invalid')).toThrow(
      'Invalid OIDC_CLIENTS_JSON: expected a JSON array',
    );
  });

  it('rejects invalid client fields', () => {
    expect(() =>
      parseOidcClients(
        JSON.stringify([{ ...client, clientSecret: 'short', launchUrl: 'file:///tmp/app' }]),
      ),
    ).toThrow('Invalid OIDC_CLIENTS_JSON');
  });

  it('rejects duplicate client IDs in the JSON array', () => {
    expect(() => parseOidcClients(JSON.stringify([client, client]))).toThrow(
      'duplicate clientId "reporting"',
    );
  });

  it('rejects a client ID that duplicates the legacy client', () => {
    expect(() => parseOidcClients(JSON.stringify([client]), 'reporting')).toThrow(
      'duplicates OIDC_CLIENT_ID',
    );
  });
});
