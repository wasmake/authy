import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Work email').fill('admin@acme.test');
  await page.getByRole('button', { name: 'Continue' }).click();
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

test('admin can configure email delivery and edit templates', async ({ page }) => {
  await page.getByRole('link', { name: 'Email delivery' }).click();
  await expect(
    page.getByRole('heading', { name: 'Emails that feel like your workspace' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Resend delivery' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /User credentials/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: /Password reset/ }).click();
  await expect(page.getByLabel('Subject')).toHaveValue(/Reset your .* password/);
  await expect(page.getByTitle('Insert {{resetUrl}}')).toBeVisible();
  await expect(page.getByTitle('Insert {{temporaryPassword}}')).toHaveCount(0);
  await expect(page.getByTitle('Email template preview')).toBeVisible();
});

test('admin can access member credential regeneration', async ({ page }) => {
  await page.getByRole('link', { name: 'People' }).click();
  const member = page.locator('tr', { hasText: 'user@acme.test' });
  await member.getByRole('button', { name: /Manage/ }).click();
  await expect(page.getByRole('heading', { name: 'New sign-in credentials' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email new credentials' })).toBeVisible();
});
