# E2E Testing Troubleshooting Guide

## Common Issues and Solutions

### Installation Issues

#### Issue: Playwright Installation Fails

**Symptoms:**
- `npx playwright install` fails
- Missing system dependencies
- Browser download errors

**Solutions:**

```bash
# Full reinstall with system dependencies
npx playwright install --with-deps

# Clear cache and reinstall
rm -rf node_modules
rm package-lock.json
npm install
npx playwright install --with-deps

# Install specific browser only
npx playwright install chromium

# Check system requirements
npx playwright install --dry-run
```

**Platform-specific:**

Ubuntu/Debian:
```bash
sudo npx playwright install-deps
```

Windows:
- Run as Administrator if permission errors
- Ensure Windows Defender isn't blocking downloads

macOS:
- Allow browser installation in System Preferences → Security

---

### Test Execution Issues

#### Issue: Tests Timeout Constantly

**Symptoms:**
- Tests hang and timeout after 30 seconds
- "Timeout exceeded" errors
- Page never loads

**Possible Causes & Solutions:**

1. **Dev server not starting:**
   ```bash
   # Start server manually before tests
   npm run start
   
   # In another terminal:
   npm run test:e2e -- --grep "your test"
   ```

2. **Slow network/GitHub API:**
   ```javascript
   // Use mocks in your tests
   import { mockGitHubAPI } from '../helpers/github-helper.js';
   
   test.beforeEach(async ({ page }) => {
     await mockGitHubAPI(page);
   });
   ```

3. **Increase timeout for specific tests:**
   ```javascript
   test('slow operation', async ({ page }) => {
     test.setTimeout(60000); // 60 seconds
     // ... test code
   });
   ```

4. **Firebase not initialized:**
   - Check Firebase config in `src/firebase-init.js`
   - Verify API keys are set
   - Use Firebase emulators for testing

#### Issue: Flaky Tests

**Symptoms:**
- Tests pass sometimes, fail others
- "Element not found" errors intermittently
- Race conditions

**Diagnosis:**

Run test 10 times to confirm flakiness:
```bash
for i in {1..10}; do npm run test:e2e -- tests/e2e/workflows/your-test.spec.js; done
```

**Common Fixes:**

1. **Add proper waits:**
   ```javascript
   // ❌ BAD - Race condition
   await page.click('#button');
   expect(await page.textContent('#result')).toBe('Done');
   
   // ✅ GOOD - Wait for state
   await page.click('#button');
   await expect(page.locator('#result')).toHaveText('Done');
   ```

2. **Wait for network idle:**
   ```javascript
   await page.goto('/');
   await page.waitForLoadState('networkidle');
   ```

3. **Wait for animations:**
   ```javascript
   await page.click('.folder');
   await page.waitForTimeout(500); // Allow CSS animation
   await expect(page.locator('.folder-contents')).toBeVisible();
   ```

4. **Retry assertions:**
   ```javascript
   // Playwright auto-retries expects
   await expect(page.locator('#status')).toHaveText('Ready', { timeout: 5000 });
   ```

#### Issue: Selector Not Found

**Symptoms:**
- "Waiting for selector '#element' failed"
- Element exists visually but test can't find it
- Selector worked before, now fails

**Solutions:**

1. **Use Playwright Inspector to find selectors:**
   ```bash
   npx playwright test --debug tests/e2e/workflows/your-test.spec.js
   ```
   - Use the "Pick Locator" tool to get correct selectors

2. **Check selector strategy:**
   ```javascript
   // Try different selectors
   page.locator('#id')
   page.locator('.class')
   page.locator('[data-testid="element"]')
   page.locator('text="Button Text"')
   page.locator('button:has-text("Submit")')
   page.getByRole('button', { name: 'Submit' })
   page.getByLabel('Email')
   ```

3. **Wait for element to be ready:**
   ```javascript
   await page.waitForSelector('#element', { 
     state: 'visible',
     timeout: 5000 
   });
   ```

4. **Check for iframes:**
   ```javascript
   const frame = page.frameLocator('iframe[name="content"]');
   await frame.locator('#element').click();
   ```

---

### Authentication Issues

#### Issue: Auth Tests Always Fail

**Symptoms:**
- "User not authenticated" errors
- Login flow doesn't complete
- Token not persisting

**Solutions:**

1. **Use test fixtures correctly:**
   ```javascript
   import { setGitHubToken } from '../helpers/github-helper.js';
   import { testUser } from '../fixtures/test-data.js';
   
   test.beforeEach(async ({ page }) => {
     await setGitHubToken(page, testUser.githubToken);
     await page.evaluate((user) => {
       localStorage.setItem('githubUser', JSON.stringify(user));
     }, testUser);
   });
   ```

2. **Mock OAuth flow:**
   ```javascript
   import { mockGitHubOAuth } from '../helpers/github-helper.js';
   
   await mockGitHubOAuth(page);
   ```

3. **Check localStorage persistence:**
   ```javascript
   // Verify token was set
   const token = await page.evaluate(() => localStorage.getItem('githubToken'));
   console.log('Token:', token);
   ```

4. **Clear auth between tests:**
   ```javascript
   test.afterEach(async ({ page }) => {
     await page.evaluate(() => {
       localStorage.clear();
       sessionStorage.clear();
     });
   });
   ```

---

### CI/CD Issues

#### Issue: Tests Pass Locally, Fail in CI

**Symptoms:**
- Green locally, red in GitHub Actions
- Timing issues in CI
- Missing dependencies in CI

**Diagnosis:**

1. **Check CI logs thoroughly:**
   - Look at test output
   - Check browser console logs
   - Review screenshots/videos from artifacts

2. **Run tests in CI-like environment:**
   ```bash
   CI=true npm run test:e2e
   ```

**Common Fixes:**

1. **Environment variables:**
   - Add secrets to GitHub Actions
   - Check `.env.test` is loaded
   - Verify `BASE_URL` is correct

2. **Timing differences:**
   ```javascript
   // CI is slower - increase timeouts
   test.setTimeout(process.env.CI ? 60000 : 30000);
   ```

3. **Missing system dependencies:**
   ```yaml
   # In .github/workflows/e2e-tests.yml
   - name: Install Playwright browsers
     run: npx playwright install --with-deps chromium
   ```

4. **Headless issues:**
   ```javascript
   // Some tests need headed mode
   use: {
     headless: !process.env.DEBUG,
   }
   ```

#### Issue: GitHub Actions Workflow Fails

**Check these files:**
- [.github/workflows/e2e-tests.yml](../.github/workflows/e2e-tests.yml)
- [.github/workflows/smoke-tests.yml](../.github/workflows/smoke-tests.yml)

**Common fixes:**

1. **Update Node version:**
   ```yaml
   - uses: actions/setup-node@v4
     with:
       node-version: 20  # Use LTS version
   ```

2. **Cache dependencies:**
   ```yaml
   - uses: actions/setup-node@v4
     with:
       node-version: 20
       cache: 'npm'
   ```

3. **Increase timeout:**
   ```yaml
   jobs:
     test:
       timeout-minutes: 60  # Increase if needed
   ```

---

### Browser-Specific Issues

#### Issue: Test Passes in Chromium, Fails in Firefox/WebKit

**Symptoms:**
- Cross-browser inconsistencies
- Selector works in one browser, not others
- Different behavior in Firefox/Safari

**Solutions:**

1. **Use cross-browser compatible selectors:**
   ```javascript
   // ❌ BAD - CSS4 selectors not universal
   page.locator('div:has(> p)')
   
   // ✅ GOOD - Universal
   page.locator('[data-testid="container"]')
   page.getByRole('button')
   ```

2. **Check browser quirks:**
   ```javascript
   // Firefox needs explicit waits sometimes
   if (browserName() === 'firefox') {
     await page.waitForTimeout(500);
   }
   ```

3. **Run single browser for debugging:**
   ```bash
   npx playwright test --project=firefox tests/e2e/workflows/your-test.spec.js
   ```

4. **Check WebKit-specific issues:**
   - WebKit doesn't support some modern web APIs
   - Check clipboard, notifications, service workers
   - May need polyfills or feature detection

---

### Performance & Resource Issues

#### Issue: Tests Run Extremely Slow

**Symptoms:**
- Each test takes minutes
- High CPU/memory usage
- Browser crashes

**Solutions:**

1. **Run fewer workers:**
   ```javascript
   // playwright.config.js
   workers: process.env.CI ? 1 : 2
   ```

2. **Disable videos for passing tests:**
   ```javascript
   use: {
     video: 'retain-on-failure',  // Not 'on'
     screenshot: 'only-on-failure'
   }
   ```

3. **Mock heavy operations:**
   ```javascript
   // Don't actually download large files in tests
   await page.route('**/large-file.zip', route => {
     route.fulfill({ status: 200, body: 'mock' });
   });
   ```

4. **Close unused contexts:**
   ```javascript
   test.afterEach(async ({ context }) => {
     await context.close();
   });
   ```

#### Issue: Out of Memory Errors

**Solutions:**

```bash
# Increase Node memory limit
NODE_OPTIONS=--max-old-space-size=4096 npm run test:e2e

# Or in package.json:
"test:e2e": "NODE_OPTIONS=--max-old-space-size=4096 playwright test"
```

---

### Debugging Strategies

#### General Debugging Workflow

1. **Isolate the failing test:**
   ```javascript
   test.only('this specific test', async ({ page }) => {
     // ...
   });
   ```

2. **Run in headed mode:**
   ```bash
   npm run test:e2e:headed
   ```

3. **Use Playwright Inspector:**
   ```bash
   npx playwright test --debug tests/e2e/workflows/your-test.spec.js
   ```

4. **Add console logs:**
   ```javascript
   test('debug test', async ({ page }) => {
     console.log('Step 1: Navigate');
     await page.goto('/');
     
     console.log('Step 2: Click button');
     await page.click('#button');
     
     console.log('Step 3: Check result');
     const result = await page.textContent('#result');
     console.log('Result:', result);
   });
   ```

5. **Take screenshots manually:**
   ```javascript
   await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
   ```

6. **Pause test execution:**
   ```javascript
   await page.pause(); // Opens Playwright Inspector
   ```

#### Reading Test Traces

After failure:
```bash
npx playwright show-trace test-results/path-to-test/trace.zip
```

Trace includes:
- **Timeline** - Every action with timing
- **Snapshots** - DOM state at each step
- **Network** - All requests/responses
- **Console** - Browser console logs
- **Source** - Test code with current line

#### Browser Console Errors

Capture console output:
```javascript
test('check console', async ({ page }) => {
  const logs = [];
  
  page.on('console', msg => {
    logs.push(`${msg.type()}: ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    logs.push(`Error: ${error.message}`);
  });
  
  await page.goto('/');
  
  console.log('Browser logs:', logs);
});
```

---

### Network & API Issues

#### Issue: GitHub API Rate Limiting

**Symptoms:**
- "API rate limit exceeded"
- 403 errors from github.com
- Tests fail due to missing data

**Solutions:**

1. **Use GitHub API mocks:**
   ```javascript
   import { mockGitHubAPI } from '../helpers/github-helper.js';
   
   test.beforeEach(async ({ page }) => {
     await mockGitHubAPI(page);
   });
   ```

2. **Use authenticated requests (higher limits):**
   ```bash
   # In .env.test
   GITHUB_TEST_TOKEN=your_personal_access_token
   ```

3. **Cache API responses:**
   - Mock responses based on real data
   - Don't hit API repeatedly

#### Issue: Firebase Connection Errors

**Solutions:**

1. **Use Firebase emulators:**
   ```bash
   # Start emulators
   firebase emulators:start --only auth,firestore
   
   # In another terminal
   npm run test:e2e
   ```

2. **Set emulator hosts:**
   ```javascript
   // In test setup
   await page.addInitScript(() => {
     window.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
     window.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
   });
   ```

---

### Getting Help

If you're still stuck:

1. **Check existing issues:**
   - Search project issues
   - Search Playwright issues

2. **Create minimal reproduction:**
   - Simplify test to minimal failing case
   - Remove dependencies on other tests

3. **Gather diagnostics:**
   - Test trace: `npx playwright show-trace trace.zip`
   - Screenshots from `test-results/`
   - Full error messages from console
   - Playwright version: `npx playwright --version`

4. **Ask for help:**
   - Open GitHub issue with:
     - Minimal reproduction code
     - Error messages
     - Screenshots/traces
     - Environment (OS, Node version, browser)

---

## Quick Reference

### Useful Commands

```bash
# Debug specific test
npx playwright test --debug path/to/test.spec.js

# Run with trace
npx playwright test --trace on

# Show last report
npx playwright show-report

# Update snapshots
npx playwright test --update-snapshots

# List all tests
npx playwright test --list

# Run tests matching pattern
npx playwright test --grep "login"
```

### Environment Variables

```bash
# Run with custom base URL
BASE_URL=http://localhost:5000 npm run test:e2e

# Debug mode
DEBUG=pw:api npm run test:e2e

# Headed mode
HEADED=true npm run test:e2e

# Specific browser
npm run test:e2e -- --project=firefox
```

### Common Selectors

```javascript
// By role (most resilient)
page.getByRole('button', { name: 'Submit' })

// By text
page.locator('text="Sign in"')
page.locator('button:has-text("Save")')

// By label
page.getByLabel('Email address')

// By placeholder
page.getByPlaceholder('Enter your name')

// By test ID
page.locator('[data-testid="submit"]')

// By ID
page.locator('#submitBtn')

// Multiple selectors
page.locator('button, [role="button"]')
```
