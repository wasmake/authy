export function applicationLaunchUrl(applicationId: string): string {
  return `/api/v1/applications/${applicationId}/launch`;
}

export function openApplicationInFocusedTab(applicationId: string): boolean {
  const tab = window.open(applicationLaunchUrl(applicationId), '_blank');
  if (!tab) return false;

  tab.opener = null;
  tab.focus();
  return true;
}
