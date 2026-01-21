# E2E Testing Guide

## Overview

This project uses [Playwright](https://playwright.dev/) for end-to-end testing. E2E tests validate critical user workflows across multiple browsers and ensure the application works correctly in real-world scenarios.

## Quick Start

```bash
# Install dependencies (includes Playwright)
npm install

# Install Playwright browsers
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run tests with UI (great for development)
npm run test:e2e:ui

# Run smoke tests only (fast)
npm run test:e2e:smoke

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug a specific test
npx playwright test --debug tests/e2e/workflows/prompt-browsing.spec.js
```

## Test Structure

```
tests/e2e/
├── fixtures/          # Test data and auth states
├── helpers/           # Reusable utilities (navigation, assertions)
├── workflows/         # Main user workflow tests
├── smoke/            # Fast critical path tests for CI
├── performance/      # Load time and performance tests
└── accessibility/    # WCAG compliance and a11y tests
```

## Writing E2E Tests

### Test Philosophy

1. **Test user workflows, not implementation details**
   - Focus on what users do, not how the code works
   - Use user-facing selectors (text, labels, roles)
   - Avoid testing internal state or private methods

2. **Keep tests isolated and independent**
   - Each test should work standalone
   - Don't rely on test execution order
   - Clean up state between tests

3. **Make tests resilient**
   - Use proper waits (`waitForSelector`, not `sleep`)
   - Handle loading states and animations
   - Expect and handle network delays

### Example Test

```javascript
import { test, expect } from '@playwright/test';
import { navigateToPrompt } from '../helpers/navigation.js';
import { expectPromptLoaded } from '../helpers/assertions.js';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup common state
    await page.goto('/');
  });

  test('user can perform action', async ({ page }) => {
    // Arrange - set up test conditions
    await navigateToPrompt(page, 'prompts/test.md');
    
    // Act - perform the action
    await page.click('#actionButton');
    
    // Assert - verify expected outcome
    await expectPromptLoaded(page, 'Test Prompt');
  });
});
```

### Helpers and Utilities

Use the provided helper functions for common operations:

**Navigation helpers** (`tests/e2e/helpers/navigation.js`):
- `navigateToPrompt(page, promptPath)` - Navigate to specific prompt
- `navigateToPage(page, pageName)` - Navigate to app pages
- `authenticateUser(page, user)` - Log in a test user
- `expandFolder(page, folderPath)` - Expand file tree folder

**Assertion helpers** (`tests/e2e/helpers/assertions.js`):
- `expectPromptLoaded(page, title)` - Verify prompt rendered
- `expectAuthenticationSuccess(page)` - Verify logged in
- `expectFileTreeLoaded(page)` - Verify file tree present
- `expectJulesModalOpen(page)` - Verify Jules modal visible

**GitHub helpers** (`tests/e2e/helpers/github-helper.js`):
- `mockGitHubAPI(page)` - Mock GitHub API responses
- `setGitHubToken(page, token)` - Set auth token
- `mockGitHubOAuth(page)` - Mock OAuth flow

### Selectors Best Practices

**Priority order for selectors:**

1. **User-facing attributes** (best)
   ```javascript
   page.locator('button:has-text("Save")')
   page.locator('[aria-label="Close dialog"]')
   page.getByRole('button', { name: 'Submit' })
   ```

2. **Data attributes** (good)
   ```javascript
   page.locator('[data-testid="submit-button"]')
   page.locator('[data-file-path="prompts/test.md"]')
   ```

3. **IDs** (acceptable)
   ```javascript
   page.locator('#submitBtn')
   ```

4. **Classes** (use sparingly)
   ```javascript
   page.locator('.submit-button')
   ```

5. **Avoid:**
   - XPath expressions
   - Deep CSS selectors
   - Brittle selectors tied to structure

## Running Tests

### Local Development

```bash
# Run all tests (headless)
npm run test:e2e

# Run with interactive UI
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/workflows/auth-flow.spec.js

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific browser only
npx playwright test --project=chromium

# Debug a failing test
npx playwright test --debug tests/e2e/workflows/prompt-actions.spec.js
```

### View Test Reports

```bash
# Show last test run report
npm run test:e2e:report

# Reports are generated at: playwright-report/index.html
```

### CI/CD

Tests run automatically on:
- **Every PR** - Smoke tests only (fast)
- **Main branch pushes** - Full E2E suite
- **Daily schedule** - Full E2E suite at midnight UTC
- **Manual trigger** - Via GitHub Actions UI

## Test Configuration

### Playwright Config

[playwright.config.js](../../playwright.config.js):
- **Projects**: Chromium, Firefox, WebKit, Mobile Chrome
- **Retries**: 1 locally, 2 in CI
- **Timeout**: 30 seconds per test
- **Workers**: 1 (sequential execution for E2E)
- **Artifacts**: Screenshots, videos, traces on failure

### Environment Variables

[.env.test](../../.env.test):
```bash
BASE_URL=http://localhost:3000
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIRESTORE_EMULATOR_HOST=localhost:8080
GITHUB_TEST_TOKEN=your_test_token
```

## Debugging Tests

### Using Playwright Inspector

```bash
# Debug mode - step through test
npx playwright test --debug tests/e2e/workflows/auth-flow.spec.js

# Debug from specific line
npx playwright test --debug tests/e2e/workflows/auth-flow.spec.js:15
```

### Using VS Code

1. Install [Playwright Test for VSCode](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)
2. Click the green play button next to tests
3. Set breakpoints in test code
4. Debug with full VS Code debugging tools

### Viewing Test Traces

After test failure:
```bash
# View trace from last run
npx playwright show-trace trace.zip

# Or open from test results:
# test-results/{test-name}/trace.zip
```

Trace includes:
- DOM snapshots at each step
- Network requests
- Console logs
- Action timeline

## Common Patterns

### Waiting for Elements

```javascript
// Wait for element to be visible
await page.waitForSelector('#content', { timeout: 5000 });

// Wait for navigation to complete
await page.waitForLoadState('networkidle');

// Wait for specific state
await expect(page.locator('#status')).toHaveText('Ready');
```

### Handling Modals

```javascript
// Open modal
await page.click('#openModalBtn');
await page.waitForSelector('#modal', { timeout: 3000 });

// Interact with modal
await page.fill('#input', 'value');
await page.click('#submitBtn');

// Close modal
const closeBtn = page.locator('#modal .close');
await closeBtn.click();
await expect(page.locator('#modal')).not.toBeVisible();
```

### Testing Authentication

```javascript
import { setGitHubToken } from '../helpers/github-helper.js';
import { testUser } from '../fixtures/test-data.js';

test('authenticated user can access profile', async ({ page }) => {
  // Set auth state
  await setGitHubToken(page, testUser.githubToken);
  
  await page.evaluate((user) => {
    localStorage.setItem('githubUser', JSON.stringify({
      login: user.githubUsername,
      name: user.displayName
    }));
  }, testUser);
  
  await page.reload();
  
  // Now proceed with test...
});
```

### Testing Clipboard

```javascript
test('copy button works', async ({ page, context }) => {
  // Grant clipboard permissions
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  
  await page.click('#copyBtn');
  
  // Read clipboard
  const clipboardText = await page.evaluate(() => 
    navigator.clipboard.readText()
  );
  
  expect(clipboardText).toContain('expected content');
});
```

## Test Coverage Goals

| Category | Tests | Priority | Status |
|----------|-------|----------|--------|
| Prompt Browsing | 10+ | 🔴 Critical | ✅ Complete |
| Prompt Actions | 8+ | 🔴 Critical | ✅ Complete |
| Authentication | 9+ | 🟠 High | ✅ Complete |
| Jules Integration | 9+ | 🟠 High | ✅ Complete |
| Performance | 7+ | 🟡 Medium | ✅ Complete |
| Accessibility | 10+ | 🟡 Medium | ✅ Complete |
| Smoke Tests | 15+ | 🔴 Critical | ✅ Complete |

## Best Practices

### DO ✅

- ✅ Use descriptive test names: `test('user can copy prompt to clipboard')`
- ✅ Keep tests focused - one workflow per test
- ✅ Use helper functions for common actions
- ✅ Mock external APIs to avoid rate limits
- ✅ Grant only necessary permissions
- ✅ Clean up after tests (close modals, clear storage)
- ✅ Use `expect` assertions, not `toBeTruthy`
- ✅ Wait for specific conditions, not arbitrary timeouts

### DON'T ❌

- ❌ Use `page.waitForTimeout()` (use `waitForSelector` instead)
- ❌ Test implementation details
- ❌ Make tests dependent on each other
- ❌ Use overly specific selectors
- ❌ Ignore flaky tests (fix them!)
- ❌ Skip cleanup in beforeEach/afterEach
- ❌ Hard-code test data (use fixtures)
- ❌ Test without understanding failure modes

## Performance Considerations

E2E tests are slower than unit tests. Optimize by:

1. **Run smoke tests in CI** - Fast critical path checks
2. **Full suite nightly** - Comprehensive testing off critical path
3. **Parallel where possible** - Independent test files run in parallel
4. **Mock external services** - GitHub API, Firebase in test mode
5. **Reuse browser contexts** - For tests with shared setup

## Troubleshooting

### Tests Fail Locally But Pass in CI

- Check environment variables in `.env.test`
- Verify same Node.js version
- Clear browser cache: `npx playwright install --force`
- Check for race conditions (timing-dependent tests)

### Tests Are Flaky

- Add proper waits: `waitForSelector`, `waitForLoadState`
- Avoid `waitForTimeout` except for animations
- Use `expect().toBeVisible()` instead of direct assertions
- Check for network delays - add retry logic

### Browser Not Found

```bash
# Reinstall browsers
npx playwright install --with-deps

# Or specific browser:
npx playwright install chromium
```

### Tests Timeout

- Increase timeout in test:
  ```javascript
  test.setTimeout(60000); // 60 seconds
  ```
- Check network conditions
- Verify dev server is running
- Look for infinite loops or hanging requests

## Contributing

When adding new E2E tests:

1. **Add test to appropriate category**
   - Workflows for user journeys
   - Smoke for critical paths
   - Performance for load testing
   - Accessibility for a11y checks

2. **Use existing helpers** - Don't reinvent navigation/assertions

3. **Add to smoke tests if critical** - Core functionality should be in smoke suite

4. **Document complex test scenarios** - Explain WHY, not just WHAT

5. **Run full suite before PR** - `npm run test:e2e`

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices Guide](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [VS Code Extension](https://playwright.dev/docs/getting-started-vscode)
- [CI/CD Integration](https://playwright.dev/docs/ci)

## Support

For questions or issues:
1. Check existing test examples in `tests/e2e/`
2. Review Playwright documentation
3. Open an issue with test reproduction
4. Tag tests with `.only` for isolated debugging
