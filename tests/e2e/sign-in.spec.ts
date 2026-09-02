import { expect, test } from '@playwright/test';
test('user signs in and sees assigned applications', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Work email').fill('user@acme.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Password').fill('DemoPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Welcome to your workspace/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open/ }).first()).toBeVisible();
  await page.evaluate(() => {
    const state = window as Window & { organizationFallbackSeen?: boolean };
    state.organizationFallbackSeen = false;
    new MutationObserver(() => {
      const brand = document.querySelector('a[aria-label="Authy home"]');
      if (brand?.textContent?.trim() === 'Authy') state.organizationFallbackSeen = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole('link', { name: 'Marketplace' }).click();
  await expect(page.getByRole('heading', { name: 'Discover your toolkit' })).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as Window & { organizationFallbackSeen?: boolean }).organizationFallbackSeen,
    ),
  ).toBe(false);
  await page.locator('aside a').last().click();
  await page.getByRole('button', { name: /Sign out this session/ }).click();
  await expect(page).toHaveURL(/sign-in/);
});
test('unauthenticated users cannot access applications API', async ({ request }) => {
  const response = await request.get('/api/v1/applications');
  expect(response.status()).toBe(401);
});
