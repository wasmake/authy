import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Work email').fill('admin@acme.test');
  await page.getByLabel('Password').fill('DemoPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/');
});

test('admin can navigate integrations and RBAC groups', async ({ page }) => {
  await page.getByRole('link', { name: 'Applications' }).click();
  await expect(
    page.getByRole('heading', { name: 'Connect the tools your team uses' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add integration' }).click();
  await expect(page.getByText('Choose a starting point')).toBeVisible();
  await page.getByRole('link', { name: 'Groups & RBAC' }).click();
  await expect(page.getByRole('heading', { name: 'Teams and permissions' })).toBeVisible();
  await expect(page.getByText('Engineering', { exact: true })).toBeVisible();
});

test('spotlight finds admin settings', async ({ page }) => {
  await page.getByRole('button', { name: /Search apps and settings/ }).click();
  await page.getByLabel('Search applications and navigation').fill('brand');
  await page.getByRole('button', { name: /Organization settings/ }).click();
  await expect(page.getByRole('heading', { name: 'Make the workspace yours' })).toBeVisible();
});
