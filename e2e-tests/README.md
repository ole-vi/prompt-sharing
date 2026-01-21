# E2E Testing

End-to-end testing for the prompt-sharing application using Playwright.

## Quick Start

```bash
# Install browsers
npx playwright install --with-deps

# Run smoke tests (fast, 15 tests)
npm run test:e2e:smoke

# Run all E2E tests
npm run test:e2e

# Run with UI (best for development)
npm run test:e2e:ui

# View test report
npm run test:e2e:report
```

## Test Organization

```
tests/e2e/
├── fixtures/           # Test data and auth state
├── helpers/            # Reusable utilities
├── workflows/          # Main user workflow tests
├── smoke/              # Critical path tests for CI
├── performance/        # Load time and performance tests
└── accessibility/      # WCAG compliance tests
```

## Test Categories

**Smoke Tests** (15 tests, ~5 min)
- Critical user paths
- Runs on every push/PR
- Must pass before merge

**Workflow Tests** (38 tests, ~15 min)
- Prompt browsing and navigation
- Prompt actions (copy, share, Jules)
- Authentication flows
- Jules API integration

**Performance Tests** (7 tests)
- Page load times
- Memory usage
- Core Web Vitals

**Accessibility Tests** (10 tests)
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support

## Common Commands

```bash
# Run specific test file
npx playwright test tests/e2e/workflows/prompt-browsing.spec.js

# Run specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox

# Debug test
npx playwright test --debug tests/e2e/workflows/auth-flow.spec.js

# Run tests matching pattern
npx playwright test --grep "copy"

# Run in headed mode (see browser)
npm run test:e2e:headed
```

## Configuration

**playwright.config.js** - Main configuration
- Base URL: `http://localhost:3000`
- Browsers: Chromium, Firefox, WebKit, Mobile Chrome
- Timeouts: 30s per test
- Retries: 1 local, 2 CI
- Auto-starts Python dev server

**.env.test** - Environment variables
- `BASE_URL` - Application URL
- `GITHUB_TEST_TOKEN` - Optional GitHub token (tests use mocks by default)

## Helper Functions

**Navigation** (`helpers/navigation.js`)
- `navigateToPrompt(page, repoOwner, repoName, filePath)` - Navigate to specific prompt
- `authenticateUser(page, user)` - Mock authentication
- `selectRepo(page, repoName)` - Switch repository
- `expandFolder(page, folderName)` - Expand file tree folder
- `openJulesModal(page)` - Open Jules configuration modal

**Assertions** (`helpers/assertions.js`)
- `expectPromptLoaded(page, filename)` - Verify prompt displayed
- `expectAuthenticationSuccess(page)` - Verify signed in
- `expectFileTreeLoaded(page)` - Verify file tree rendered
- `expectClipboardContains(page, text)` - Verify clipboard content

**GitHub API Mocking** (`helpers/github-helper.js`)
- `mockGitHubAPI(page)` - Mock all GitHub API calls
- `mockGitHubOAuth(page)` - Mock OAuth flow
- `getMockRepoTree()` - Get mock repository structure

## Writing Tests

```javascript
import { test, expect } from '@playwright/test';
import { navigateToPrompt, authenticateUser } from '../helpers/navigation.js';
import { expectPromptLoaded } from '../helpers/assertions.js';
import { mockGitHubAPI } from '../helpers/github-helper.js';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await mockGitHubAPI(page); // Prevent GitHub API rate limiting
    await page.goto('/');
  });

  test('user can do something', async ({ page }) => {
    await navigateToPrompt(page, 'owner', 'repo', 'path/to/file.md');
    await expectPromptLoaded(page, 'file.md');
    
    // Your test assertions
    await expect(page.locator('.my-element')).toBeVisible();
  });
});
```

## Debugging

**View screenshots/videos:**
- Failed tests save artifacts to `test-results/`
- Screenshots, videos, and traces available

**Debug a specific test:**
```bash
npx playwright test --debug tests/e2e/workflows/auth-flow.spec.js:25
```

**View trace for failed test:**
```bash
npx playwright show-trace test-results/path-to-test/trace.zip
```

**Verbose logging:**
```bash
DEBUG=pw:api npm run test:e2e
```

## CI/CD

Tests run automatically via GitHub Actions:

**Smoke Tests** (`.github/workflows/smoke-tests.yml`)
- Trigger: Every push, every PR
- Browser: Chromium only
- Duration: ~5 minutes

**Full E2E Suite** (`.github/workflows/e2e-tests.yml`)
- Trigger: Push/PR to main/develop, daily schedule
- Browsers: All (Chromium, Firefox, WebKit, Mobile Chrome)
- Duration: ~30 minutes

## Troubleshooting

**Tests timeout:**
- Increase timeout in `playwright.config.js`
- Check if dev server started properly
- Look for "Web server started" in output

**Selector not found:**
- Use `--debug` to inspect elements
- Check if element IDs match your app's HTML
- Verify element is visible before interaction

**GitHub API rate limit:**
- Tests use mocks by default (enabled in `beforeEach`)
- If you see 403/429 errors, check mocks are configured
- Or add real token to `.env.test`

**Flaky tests:**
- Replace `waitForTimeout()` with `waitForSelector()`
- Wait for network idle: `page.waitForLoadState('networkidle')`
- Check for race conditions

**Browser not found:**
```bash
npx playwright install --with-deps
```

## Best Practices

1. **Use helper functions** - Keep tests DRY with navigation/assertion helpers
2. **Mock external APIs** - Prevent rate limiting and ensure consistent test data
3. **Wait properly** - Use `waitForSelector()`, not arbitrary timeouts
4. **Test user behavior** - Click buttons, don't call JavaScript functions
5. **Keep tests independent** - Each test should work in isolation
6. **Use descriptive test names** - Make failures easy to understand

## Test Coverage

Total: 70 tests across 7 categories
- Smoke: 15 tests (critical paths)
- Workflows: 38 tests (browsing, actions, auth, Jules)
- Performance: 7 tests (load times, memory)
- Accessibility: 10 tests (WCAG compliance)

## Known Limitations

- Browser extension tests not implemented (requires complex Chrome extension loading)
- Jules API tests use mocks (real API testing requires valid API key)
- Some tests may be slower on first run (cold start)
