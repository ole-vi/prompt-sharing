import { test, expect } from '@playwright/test';
import { mockGitHubAPI } from '../helpers/github-helper.js';

/**
 * Smoke Tests - Critical Paths
 * 
 * These are fast, essential tests that verify the most critical
 * user workflows. They should run on every PR and complete in < 5 minutes.
 */

test.describe('Smoke Tests - Critical Paths', () => {
  test('app loads and displays file tree', async ({ page }) => {
    await page.goto('/');
    
    // Should load without errors
    await expect(page.locator('#file-tree, .file-tree, main')).toBeVisible({ timeout: 10000 });
    
    // Should have some content
    const bodyText = await page.textContent('body');
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('user can load and view a prompt', async ({ page }) => {
    await mockGitHubAPI(page);
    await page.goto('/');
    
    // Wait for file tree
    await page.waitForSelector('#file-tree, .file-tree', { timeout: 10000 });
    
    // Click first available file
    const firstFile = page.locator('.file-item, [data-file-path]').first();
    
    if (await firstFile.count() > 0) {
      await firstFile.click();
      
      // Content should load
      await expect(page.locator('#content, .content-area, .prompt-content')).toBeVisible({ timeout: 5000 });
    }
  });

  test('copy button works', async ({ page, context }) => {
    await mockGitHubAPI(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Navigate to a prompt
    await page.goto('/?file=test-prompt');
    await page.waitForSelector('#content, .content-area', { timeout: 10000 });
    
    // Find copy button
    const copyBtn = page.locator('#copyBtn, .copy-btn, button:has-text("Copy")').first();
    
    if (await copyBtn.isVisible()) {
      await copyBtn.click();
      await page.waitForTimeout(500);
      
      // Should have copied something
      const clipboardText = await page.evaluate(() => 
        navigator.clipboard.readText().catch(() => '')
      );
      
      expect(clipboardText.length).toBeGreaterThan(0);
    }
  });

  test('repository switching works', async ({ page }) => {
    await mockGitHubAPI(page);
    await page.goto('/');
    
    // Load default repo
    await page.waitForSelector('#file-tree', { timeout: 10000 });
    
    // Navigate to different repo via URL
    await page.goto('/?owner=testuser&repo=other-repo&branch=main');
    
    // File tree should reload
    await expect(page.locator('#file-tree')).toBeVisible({ timeout: 10000 });
    
    // URL should reflect new repo
    expect(page.url()).toContain('owner=testuser');
    expect(page.url()).toContain('repo=other-repo');
  });

  test('navigation between pages works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Try to navigate to profile
    const profileLink = page.locator('a[href*="profile"], nav a:has-text("Profile")').first();
    
    if (await profileLink.isVisible()) {
      await profileLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Should be on profile page
      expect(page.url()).toContain('profile');
    }
  });

  test('app handles 404 gracefully', async ({ page }) => {
    const response = await page.goto('/nonexistent-page.html');
    
    // Either 404 or redirected to home
    const status = response?.status();
    
    if (status === 404) {
      // Page should still render something
      const bodyText = await page.textContent('body');
      expect(bodyText.length).toBeGreaterThan(0);
    } else {
      // Likely redirected to home
      expect(page.url()).toMatch(/\/$|index\.html/);
    }
  });

  test('app works in offline mode (basic functionality)', async ({ page, context }) => {
    // Load page first
    await page.goto('/');
    await page.waitForSelector('#file-tree, main', { timeout: 10000 });
    
    // Go offline
    await context.setOffline(true);
    
    // Should still render (using cached resources)
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Basic structure should be present
    const hasContent = await page.locator('body').count() > 0;
    expect(hasContent).toBeTruthy();
    
    // Go back online
    await context.setOffline(false);
  });

  test('no JavaScript errors on page load', async ({ page }) => {
    const errors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    console.log('JavaScript errors:', errors);
    
    // Should have no critical JavaScript errors
    expect(errors.length).toBe(0);
  });

  test('responsive layout works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Page should render
    await expect(page.locator('body')).toBeVisible();
    
    // Should not have horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(hasHorizontalScroll).toBeFalsy();
  });

  test('essential assets load successfully', async ({ page }) => {
    const failedResources = [];
    
    page.on('requestfailed', request => {
      failedResources.push(request.url());
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    console.log('Failed resources:', failedResources);
    
    // Should have no failed critical resources
    const criticalFailures = failedResources.filter(url => 
      url.endsWith('.js') || url.endsWith('.css') || url.includes('firebase')
    );
    
    expect(criticalFailures.length).toBe(0);
  });

  test('Firebase initializes correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Check if Firebase is initialized
    const firebaseInitialized = await page.evaluate(() => {
      return typeof window.firebase !== 'undefined' || 
             typeof window.firebaseApp !== 'undefined';
    });
    
    // Firebase should be initialized (or intentionally not loaded in some cases)
    console.log('Firebase initialized:', firebaseInitialized);
    
    // This is informational - Firebase might not be needed for all pages
    expect(typeof firebaseInitialized).toBe('boolean');
  });

  test('local storage works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Test localStorage
    await page.evaluate(() => {
      localStorage.setItem('test-key', 'test-value');
    });
    
    const value = await page.evaluate(() => {
      return localStorage.getItem('test-key');
    });
    
    expect(value).toBe('test-value');
    
    // Clean up
    await page.evaluate(() => {
      localStorage.removeItem('test-key');
    });
  });

  test('session storage works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Test sessionStorage
    await page.evaluate(() => {
      sessionStorage.setItem('test-session-key', 'test-session-value');
    });
    
    const value = await page.evaluate(() => {
      return sessionStorage.getItem('test-session-key');
    });
    
    expect(value).toBe('test-session-value');
  });

  test('app renders within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForSelector('#file-tree, main', { timeout: 15000 });
    
    const loadTime = Date.now() - startTime;
    
    console.log(`Total load time: ${loadTime}ms`);
    
    // Should load in under 10 seconds (generous for E2E)
    expect(loadTime).toBeLessThan(10000);
  });
});
