export function applicationLaunchDestination(
  application: { launchUrl: string; type: string },
  issuer: string,
): string {
  const destination = new URL(application.launchUrl);
  if (application.type === 'OIDC') destination.searchParams.set('iss', issuer);
  return destination.toString();
}
