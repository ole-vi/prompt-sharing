# E2E Test Suite

> Comprehensive end-to-end testing for the Prompt Sharing application using Playwright

## 🎯 Overview

This directory contains all end-to-end tests that validate critical user workflows across multiple browsers. Tests simulate real user interactions and verify the application works correctly in production-like scenarios.

## 📂 Structure

```
e2e/
├── workflows/         # Main user workflow tests
│   ├── prompt-browsing.spec.js      # File tree navigation & browsing
│   ├── prompt-actions.spec.js       # Copy, share, view raw, GitHub
│   ├── auth-flow.spec.js            # Authentication & user management
│   └── jules-integration.spec.js    # Jules API integration
│
├── smoke/            # Fast critical path tests for CI
│   └── critical-paths.spec.js       # Essential app functionality
│
├── performance/      # Load time & performance benchmarks
│   └── load-time.spec.js           # Page load, rendering performance
│
├── accessibility/    # WCAG compliance & a11y testing
│   └── a11y.spec.js                # Accessibility validation
│
├── fixtures/         # Test data & authentication states
│   ├── test-data.js                # Test users, repos, prompts
│   └── auth-state.js               # Saved auth states
│
└── helpers/          # Reusable test utilities
    ├── navigation.js               # Navigation helpers
    ├── assertions.js               # Custom assertions
    ├── firebase-helper.js          # Firebase emulator utilities
    └── github-helper.js            # GitHub API mocking
```

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install --with-deps
```

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with interactive UI (best for development)
npm run test:e2e:ui

# Run smoke tests only (fast)
npm run test:e2e:smoke

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug specific test
npx playwright test --debug tests/e2e/workflows/prompt-browsing.spec.js
```

### View Results

```bash
# Show HTML test report
npm run test:e2e:report
```

## 📋 Test Categories

### Workflows (Main Test Suite)

**Prompt Browsing** - 10 tests
- File tree navigation
- Folder expand/collapse
- Repository switching
- Branch selection
- Deep linking
- State persistence

**Prompt Actions** - 10 tests
- Copy to clipboard
- Share link generation
- View raw markdown
- Open in GitHub
- Jules integration
- Keyboard shortcuts

**Authentication** - 9 tests
- GitHub OAuth flow
- User profile display
- Sign out functionality
- Session persistence
- Access control
- Error handling

**Jules Integration** - 9 tests
- API key configuration
- Prompt submission
- Queue management
- Session history
- Error handling
- Modal interactions

### Smoke Tests (Critical Paths)

15 essential tests that verify core functionality:
- App loads and displays file tree
- User can view a prompt
- Copy button works
- Navigation works
- No JavaScript errors
- Responsive layout
- Essential assets load

**Run on every PR** - Must pass before merge

### Performance Tests

7 tests measuring load times and efficiency:
- Homepage load time (< 5s)
- Prompt rendering (< 2s)
- Navigation smoothness
- Memory leak detection
- Asset loading
- Core Web Vitals

### Accessibility Tests

10 tests ensuring WCAG 2.1 AA compliance:
- No critical a11y violations
- Keyboard navigation
- Screen reader landmarks
- Proper ARIA labels
- Color contrast
- Focus indicators
- Heading hierarchy

## 🔧 Configuration

### Playwright Config

[../../playwright.config.js](../../playwright.config.js)

- **Browsers:** Chromium, Firefox, WebKit, Mobile Chrome
- **Retries:** 1 locally, 2 in CI
- **Timeout:** 30 seconds per test
- **Workers:** 1 (sequential for E2E stability)
- **Artifacts:** Screenshots, videos, traces on failure

### Environment

[../../.env.test](../../.env.test)

```bash
BASE_URL=http://localhost:3000
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIRESTORE_EMULATOR_HOST=localhost:8080
GITHUB_TEST_TOKEN=your_test_token_here
```

## 🛠️ Writing Tests

### Example Test

```javascript
import { test, expect } from '@playwright/test';
import { navigateToPrompt } from '../helpers/navigation.js';
import { expectPromptLoaded } from '../helpers/assertions.js';

test.describe('Feature Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('user can perform action', async ({ page }) => {
    // Navigate to prompt
    await navigateToPrompt(page, 'prompts/test.md');
    
    // Perform action
    await page.click('#actionButton');
    
    // Verify result
    await expectPromptLoaded(page, 'Expected Title');
  });
});
```

### Best Practices

✅ **DO:**
- Use helper functions for common operations
- Mock external APIs (GitHub, Firebase)
- Use user-facing selectors (`getByRole`, `getByText`)
- Wait for specific conditions, not arbitrary timeouts
- Keep tests isolated and independent

❌ **DON'T:**
- Use `waitForTimeout` - use `waitForSelector` instead
- Test implementation details
- Make tests dependent on execution order
- Use brittle CSS selectors
- Ignore flaky tests

## 🐛 Debugging

### Interactive Debugging

```bash
# Playwright Inspector - step through test
npx playwright test --debug tests/e2e/workflows/your-test.spec.js

# Pause test execution
# Add `await page.pause()` in your test
```

### View Test Traces

```bash
# Open trace viewer
npx playwright show-trace test-results/path-to-test/trace.zip
```

Includes:
- Action timeline
- DOM snapshots
- Network requests
- Console logs

### Common Issues

**Tests timeout?**
- Check dev server is running
- Use mocks for external APIs
- Add proper waits

**Flaky tests?**
- Use `waitForSelector` not `waitForTimeout`
- Wait for network idle: `page.waitForLoadState('networkidle')`
- Check for race conditions

**Selectors not found?**
- Use Playwright Inspector: `--debug` flag
- Try different selector strategies
- Verify element is visible: `state: 'visible'`

See [E2E_TROUBLESHOOTING.md](../../docs/E2E_TROUBLESHOOTING.md) for detailed solutions.

## 📊 CI/CD

### GitHub Actions

Tests run automatically:

**Smoke Tests** (Every PR)
- Runs in < 5 minutes
- Chromium only
- Must pass to merge

**Full E2E Suite** (Main branch + Nightly)
- All browsers: Chromium, Firefox, WebKit
- Multiple OS: Ubuntu, Windows, macOS
- Runs nightly at midnight UTC
- On-demand via workflow_dispatch

### Viewing CI Results

1. Go to GitHub Actions tab
2. Click on workflow run
3. Download artifacts: `playwright-report-{browser}`
4. Extract and open `index.html` for report

## 📈 Test Coverage

| Category | Tests | Coverage | Priority |
|----------|-------|----------|----------|
| Prompt Browsing | 10 | ✅ Complete | 🔴 Critical |
| Prompt Actions | 10 | ✅ Complete | 🔴 Critical |
| Authentication | 9 | ✅ Complete | 🟠 High |
| Jules Integration | 9 | ✅ Complete | 🟠 High |
| Performance | 7 | ✅ Complete | 🟡 Medium |
| Accessibility | 10 | ✅ Complete | 🟡 Medium |
| Smoke Tests | 15 | ✅ Complete | 🔴 Critical |
| **Total** | **70** | **✅ Complete** | |

## 🤝 Contributing

### Adding New Tests

1. **Choose appropriate directory:**
   - `workflows/` - Main user journeys
   - `smoke/` - Critical paths only
   - `performance/` - Load/render testing
   - `accessibility/` - A11y validation

2. **Use helpers:**
   - Import from `helpers/navigation.js`
   - Import from `helpers/assertions.js`
   - Add new helpers if needed

3. **Follow naming conventions:**
   - File: `feature-name.spec.js`
   - Test: `test('user can perform action')`
   - Describe: `test.describe('Feature Name')`

4. **Run locally first:**
   ```bash
   npm run test:e2e -- path/to/new-test.spec.js
   ```

5. **Add to smoke tests if critical:**
   - Core functionality goes in `smoke/critical-paths.spec.js`

## 📚 Documentation

- [E2E Testing Guide](../../docs/E2E_TESTING.md) - Complete guide to writing & running tests
- [Troubleshooting Guide](../../docs/E2E_TROUBLESHOOTING.md) - Solutions to common problems
- [Playwright Docs](https://playwright.dev/) - Official Playwright documentation

## 🔍 Helper Functions

### Navigation

```javascript
import { navigateToPrompt, navigateToPage, authenticateUser } from './helpers/navigation.js';

await navigateToPrompt(page, 'prompts/test.md');
await navigateToPage(page, 'profile');
await authenticateUser(page, testUser);
```

### Assertions

```javascript
import { expectPromptLoaded, expectAuthenticationSuccess } from './helpers/assertions.js';

await expectPromptLoaded(page, 'Prompt Title');
await expectAuthenticationSuccess(page);
```

### Mocking

```javascript
import { mockGitHubAPI, mockGitHubOAuth } from './helpers/github-helper.js';

await mockGitHubAPI(page);
await mockGitHubOAuth(page);
```

## 🎯 Goals

- ✅ **Reliability:** 95%+ pass rate
- ✅ **Speed:** Smoke tests < 5 min, full suite < 30 min
- ✅ **Coverage:** All critical user workflows
- ✅ **Maintainability:** DRY, reusable helpers
- ✅ **Cross-browser:** Chromium, Firefox, WebKit
- ✅ **Accessibility:** WCAG 2.1 AA compliance

## 📞 Support

**Issues?**
- Check [Troubleshooting Guide](../../docs/E2E_TROUBLESHOOTING.md)
- Review test traces: `npx playwright show-trace trace.zip`
- Open GitHub issue with reproduction

**Questions?**
- Read [E2E Testing Guide](../../docs/E2E_TESTING.md)
- Check [Playwright Documentation](https://playwright.dev/)
- Review existing test examples

---

**Status:** ✅ Phase 2 Complete (70 tests across 7 categories)
