// tests/state-sync.spec.js
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('App State Synchronization', () => {
  test('should sync state across tabs', async ({ context }) => {
    // Create two pages
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Go to verification page (using file protocol or local server if available)
    // Assuming local server at localhost:3000 (standard for this repo)
    const url = 'http://localhost:3000/tests/verify-state.html';

    await page1.goto(url);
    await page2.goto(url);

    // Initial check
    const sidebarCheckbox1 = page1.locator('#sidebar');
    const sidebarCheckbox2 = page2.locator('#sidebar');

    // Change state in Page 1
    await sidebarCheckbox1.check();

    // Verify Page 1 updated
    await expect(sidebarCheckbox1).toBeChecked();

    // Verify Page 2 updated (cross-tab sync)
    // Wait for event to propagate
    await expect(sidebarCheckbox2).toBeChecked();

    // Change state in Page 2
    await sidebarCheckbox2.uncheck();

    // Verify Page 1 updated
    await expect(sidebarCheckbox1).not.toBeChecked();
  });

  test('should persist state', async ({ page }) => {
    const url = 'http://localhost:3000/tests/verify-state.html';
    await page.goto(url);

    // Set preference
    await page.locator('#features').check();

    // Reload
    await page.reload();

    // Verify persistence
    await expect(page.locator('#features')).toBeChecked();
  });
});
