import { expect, test } from '@playwright/test';

test('user can prepare an application access request', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Work email').fill('user@acme.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Password').fill('DemoPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Marketplace' }).click();
  const application = page.locator('article').filter({ hasText: 'Internal Console' });
  await application.getByRole('button', { name: 'Request access' }).click();
  await page.getByLabel('Business reason').fill('Support rotation access');
  await expect(page.getByRole('button', { name: 'Send request' })).toBeEnabled();
});
