import { applicationLaunchDestination } from '@/modules/applications/launch-destination';

describe('application launch destination', () => {
  it('adds the Authy issuer to OIDC application launches', () => {
    expect(
      applicationLaunchDestination(
        {
          launchUrl: 'https://chat.example.com/auth/sign-in?callbackURL=%2Fdashboard',
          type: 'OIDC',
        },
        'https://auth.example.com',
      ),
    ).toBe(
      'https://chat.example.com/auth/sign-in?callbackURL=%2Fdashboard&iss=https%3A%2F%2Fauth.example.com',
    );
  });

  it('leaves non-OIDC application launches unchanged', () => {
    expect(
      applicationLaunchDestination(
        { launchUrl: 'https://app.example.com/path', type: 'LINK' },
        'https://auth.example.com',
      ),
    ).toBe('https://app.example.com/path');
  });
});
