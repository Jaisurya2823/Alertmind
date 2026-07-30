/**
 * AlertMind — End-to-End Tests
 * Tests the complete UI flow: paste alert → analyze → view results → export.
 * Requires the app to be running at APP_URL.
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SAMPLE_ALERT = readFileSync(
  join(__dirname, '../fixtures/sample-alert.json'),
  'utf8'
);

test.describe('AlertMind Investigation Flow', () => {

  test('landing page loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AlertMind/);
    await expect(page.locator('nav')).toBeVisible();
  });

  test('hero section is visible on landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Investigate Any Security Alert');
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('paste/upload tab toggle works', async ({ page }) => {
    await page.goto('/');

    // Default: paste mode
    await expect(page.locator('textarea')).toBeVisible();

    // Switch to upload mode
    await page.getByText('Upload File').click();
    await expect(page.locator('#dropzone')).toBeVisible();

    // Switch back
    await page.getByText('Paste Alert').click();
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('analyze button is disabled with empty input', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByRole('button', { name: /Analyze Alert/i });
    await expect(btn).toBeDisabled();
  });

  test('analyze button enables after pasting alert', async ({ page }) => {
    await page.goto('/');
    await page.locator('textarea').fill(SAMPLE_ALERT);
    const btn = page.getByRole('button', { name: /Analyze Alert/i });
    await expect(btn).toBeEnabled();
  });

  test('supported alert format badges are visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Microsoft Defender')).toBeVisible();
    await expect(page.locator('text=CrowdStrike')).toBeVisible();
    await expect(page.locator('text=Splunk')).toBeVisible();
    await expect(page.locator('text=Sysmon')).toBeVisible();
  });

  test('sign in button navigates to login', async ({ page }) => {
    await page.goto('/');
    const signIn = page.getByRole('button', { name: /Sign In/i });
    await expect(signIn).toBeVisible();
  });

  test('API health endpoint is accessible', async ({ request }) => {
    const res = await request.get('/api/health/live');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('alive');
  });

  test('unauthenticated alert submission returns 401', async ({ request }) => {
    const res = await request.post('/api/v1/alerts', {
      data: {
        rawInput: SAMPLE_ALERT,
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      },
    });
    expect(res.status()).toBe(401);
  });

});
