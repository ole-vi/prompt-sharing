# Testing Roadmap to 100% Coverage

**Status**: Foundational infrastructure complete  
**Current Coverage**: ~11% lines, ~25% functions, 50% branches  
**Target**: 100% unit test coverage + E2E test suite  
**Last Updated**: January 18, 2026

---

## Current State

### ✅ Completed (8 test files, 44 tests)

**Integration Tests:**
- `auth.test.js` - GitHub OAuth, session management (80% coverage)
- `toast.test.js` - Toast notifications UI (89% coverage)
- `jules-submission.test.js` - Jules API prompt submission
- `prompt-loading.test.js` - GitHub prompt file loading

**Utility Tests:**
- `dom-helpers.test.js` - DOM manipulation utilities (71% coverage)
- `slug.test.js` - URL slug generation (100% coverage)
- `title.test.js` - Title extraction/formatting (100% coverage)
- `validation.test.js` - Input validation (93% coverage)

**Infrastructure:**
- Vitest 2.1.9 with jsdom environment
- v8 coverage reporting
- GitHub Actions CI/CD
- Global Firebase/localStorage mocks

---

## Phase 1: Low-Hanging Fruit (Target: 30% coverage)
**Duration**: 1-2 weeks  
**Goal**: Test all pure utility functions with zero dependencies

### 1.1 Remaining Utilities (Priority: HIGH)

#### `src/utils/url-params.js` (0% coverage)
- **Functions**: `getRepoParam()`, `getBranchParam()`, `getPathParam()`, `getAllParams()`
- **Strategy**: Simple input/output tests with URLSearchParams mocking
- **Estimated Tests**: 8-10 tests
- **Complexity**: ⭐ Easy

#### `src/utils/checkbox-helpers.js` (0% coverage)
- **Functions**: Checkbox state management utilities
- **Strategy**: DOM manipulation tests with jsdom
- **Estimated Tests**: 6-8 tests
- **Complexity**: ⭐ Easy

#### `src/utils/debounce.js` (0% coverage)
- **Functions**: `debounce()`
- **Strategy**: Use `vi.useFakeTimers()` and `vi.advanceTimersByTime()`
- **Estimated Tests**: 4-6 tests (immediate call, delayed call, cancellation, multiple calls)
- **Complexity**: ⭐⭐ Medium (timing-sensitive)

#### `src/utils/lazy-loaders.js` (0% coverage)
- **Functions**: Dynamic module loading helpers
- **Strategy**: Mock `import()`, test loading states
- **Estimated Tests**: 6-8 tests
- **Complexity**: ⭐⭐ Medium (async operations)

### 1.2 Improve Existing Coverage

#### `src/utils/session-cache.js` (52% coverage → 100%)
- **Missing**: Error handling, edge cases
- **Add**: 4-6 additional tests
- **Focus**: Invalid JSON, expired cache, storage quota errors

#### `src/utils/dom-helpers.js` (71% coverage → 100%)
- **Missing**: `createElement()` edge cases, attribute handling
- **Add**: 6-8 tests
- **Focus**: Complex element creation, null handling

#### `src/utils/icon-helpers.js` (93% coverage → 100%)
- **Missing**: Error paths (lines 46-54)
- **Add**: 2-3 tests
- **Focus**: Invalid icon names, missing SVG data

---

## Phase 2: Simple UI Components (Target: 50% coverage)
**Duration**: 2-3 weeks  
**Goal**: Test stateless UI components and simple interactions

### 2.1 Stateless Components (Priority: HIGH)

#### `src/modules/dropdown.js` (0% coverage)
- **Type**: UI component - menu positioning
- **Strategy**: Test DOM structure, click handlers, positioning logic
- **Estimated Tests**: 10-12 tests
- **Key Areas**:
  - Dropdown open/close
  - Click outside to close
  - Position calculation (viewport boundaries)
  - Keyboard navigation (arrow keys, escape)
- **Complexity**: ⭐⭐ Medium

#### `src/modules/navbar.js` (0% coverage)
- **Type**: UI component - navigation
- **Strategy**: Test render, link generation, active state
- **Estimated Tests**: 6-8 tests
- **Complexity**: ⭐ Easy

#### `src/modules/sidebar.js` (0% coverage)
- **Type**: UI component - layout
- **Strategy**: Test toggle, resize, state persistence
- **Estimated Tests**: 6-8 tests
- **Complexity**: ⭐ Easy

#### `src/modules/status-bar.js` (0% coverage)
- **Type**: UI component - status messages
- **Strategy**: Similar to toast tests, DOM structure verification
- **Estimated Tests**: 8-10 tests
- **Complexity**: ⭐ Easy

#### `src/modules/header.js` (0% coverage)
- **Type**: UI component - app header
- **Strategy**: Test render, user display, sign-out button
- **Estimated Tests**: 8-10 tests
- **Dependencies**: Requires auth module (already tested)
- **Complexity**: ⭐⭐ Medium

### 2.2 Modals and Dialogs

#### `src/modules/confirm-modal.js` (0% coverage)
- **Type**: Dialog component
- **Strategy**: Refactor to return testable `show()` function, test promise resolution
- **Estimated Tests**: 10-12 tests
- **Key Areas**:
  - Show/hide behavior
  - Confirm/cancel callbacks
  - Backdrop click handling
  - Escape key handling
- **Complexity**: ⭐⭐⭐ Medium-High (requires refactoring)

---

## Phase 3: GitHub Integration (Target: 65% coverage)
**Duration**: 2-3 weeks  
**Goal**: Comprehensive GitHub API and prompt management testing

### 3.1 GitHub API (Priority: HIGH)

#### `src/modules/github-api.js` (40% coverage → 100%)
- **Type**: API wrapper
- **Current**: Basic functions tested
- **Missing**: 
  - Error handling for all endpoints
  - Rate limiting scenarios
  - Branch operations
  - File content encoding/decoding
  - Tree traversal
- **Add**: 20-25 tests
- **Strategy**: Mock `fetch()`, test all HTTP methods, error codes
- **Complexity**: ⭐⭐⭐ Medium-High

### 3.2 Prompt System

#### `src/modules/prompt-list.js` (0% coverage)
- **Type**: Complex UI component - tree navigation
- **Strategy**: Break into testable units (tree building, filtering, rendering)
- **Estimated Tests**: 25-30 tests
- **Key Areas**:
  - Tree structure generation from flat file list
  - Folder expansion/collapse
  - Search/filter functionality
  - Selection state management
  - Sorting logic
- **Complexity**: ⭐⭐⭐⭐ High (complex state management)

#### `src/modules/prompt-viewer.js` (0% coverage)
- **Type**: Content display component
- **Strategy**: Test file loading, error states, navigation
- **Estimated Tests**: 12-15 tests
- **Dependencies**: github-api, prompt-renderer
- **Complexity**: ⭐⭐⭐ Medium-High

#### `src/modules/prompt-renderer.js` (0% coverage)
- **Type**: Markdown rendering + syntax highlighting
- **Strategy**: Test markdown parsing, code block detection, sanitization
- **Estimated Tests**: 20-25 tests
- **Key Areas**:
  - Markdown to HTML conversion (marked.js integration)
  - Syntax highlighting (highlight.js)
  - Link rewriting (relative paths)
  - XSS prevention
  - Special frontmatter handling
- **Complexity**: ⭐⭐⭐⭐ High (external library integration)

### 3.3 Repository/Branch Management

#### `src/modules/repo-branch-selector.js` (0% coverage)
- **Type**: Complex UI component - repo/branch picker
- **Strategy**: Test async loading, caching, dropdown UI, switching logic
- **Estimated Tests**: 25-30 tests
- **Key Areas**:
  - Repository list loading
  - Branch list loading (per repo)
  - Caching logic
  - Switch handlers
  - Error states (no repos, private repos, API failures)
- **Complexity**: ⭐⭐⭐⭐ High

#### `src/modules/branch-selector.js` (0% coverage)
- **Type**: Simpler branch picker (single repo)
- **Strategy**: Similar to repo-branch-selector but simpler scope
- **Estimated Tests**: 15-18 tests
- **Complexity**: ⭐⭐⭐ Medium-High

#### `src/modules/folder-submenu.js` (0% coverage)
- **Type**: Context menu for folders
- **Strategy**: Test menu positioning, action handlers
- **Estimated Tests**: 10-12 tests
- **Complexity**: ⭐⭐ Medium

---

## Phase 4: Jules Integration (Target: 85% coverage)
**Duration**: 3-4 weeks  
**Goal**: Test Jules API, queue system, and AI features

### 4.1 Jules API

#### `src/modules/jules-api.js` (22% coverage → 100%)
- **Type**: AI API wrapper
- **Current**: Basic submission tested
- **Missing**:
  - All API endpoints (status, cancel, results)
  - Error handling (rate limits, quota, network failures)
  - Response parsing
  - Retry logic
  - Authentication flows
- **Add**: 30-35 tests
- **Complexity**: ⭐⭐⭐⭐ High

#### `src/modules/jules-keys.js` (0% coverage)
- **Type**: API key management
- **Strategy**: Test encryption/decryption, Firestore integration mocking
- **Estimated Tests**: 12-15 tests
- **Key Areas**:
  - Key validation
  - Secure storage (encryption)
  - Key retrieval
  - Error handling (missing keys, invalid keys)
- **Complexity**: ⭐⭐⭐ Medium-High (crypto mocking)

#### `src/modules/jules-account.js` (0% coverage)
- **Type**: Account management UI
- **Strategy**: Test form validation, API integration, state management
- **Estimated Tests**: 25-30 tests
- **Complexity**: ⭐⭐⭐⭐ High (large module, many features)

### 4.2 Jules UI Components

#### `src/modules/jules-modal.js` (0% coverage)
- **Type**: Main Jules interface modal
- **Strategy**: Test modal lifecycle, prompt input, result display
- **Estimated Tests**: 20-25 tests
- **Key Areas**:
  - Modal open/close with state preservation
  - Prompt submission flow
  - Result rendering
  - Error display
  - Loading states
- **Complexity**: ⭐⭐⭐⭐ High

#### `src/modules/jules-free-input.js` (0% coverage)
- **Type**: Freeform prompt input UI
- **Strategy**: Test text area behavior, character counting, validation
- **Estimated Tests**: 15-18 tests
- **Complexity**: ⭐⭐⭐ Medium-High

#### `src/modules/jules-subtask-modal.js` (0% coverage)
- **Type**: Subtask breakdown dialog
- **Strategy**: Test task creation, editing, reordering
- **Estimated Tests**: 20-25 tests
- **Complexity**: ⭐⭐⭐⭐ High

### 4.3 Queue System

#### `src/modules/jules-queue.js` (0% coverage)
- **Type**: **MOST COMPLEX MODULE** - Queue management
- **Strategy**: Break into multiple test files by feature area
- **Estimated Tests**: 60-80 tests (split across multiple files)
- **Suggested Test Files**:
  - `jules-queue-core.test.js` - Queue CRUD operations (15-20 tests)
  - `jules-queue-execution.test.js` - Task execution flow (20-25 tests)
  - `jules-queue-scheduling.test.js` - Schedule management (15-20 tests)
  - `jules-queue-state.test.js` - State management/sync (15-20 tests)
  - `jules-queue-ui.test.js` - UI updates/rendering (10-15 tests)
- **Key Areas**:
  - Queue item CRUD (create, read, update, delete)
  - Firestore sync operations
  - Task execution pipeline
  - Schedule parsing and next-run calculation
  - Retry logic and error handling
  - Progress tracking
  - Batch operations
  - Filtering and sorting
  - UI state management
- **Complexity**: ⭐⭐⭐⭐⭐ Very High (1122 lines!)
- **Recommendation**: Consider refactoring into smaller modules first

#### `src/modules/subtask-manager.js` (0% coverage)
- **Type**: Subtask execution logic
- **Strategy**: Test subtask lifecycle, dependencies, error handling
- **Estimated Tests**: 20-25 tests
- **Complexity**: ⭐⭐⭐⭐ High

---

## Phase 5: Page Initialization (Target: 95% coverage)
**Duration**: 1-2 weeks  
**Goal**: Test page-level coordination and routing

### 5.1 Page Scripts

#### `src/pages/*.js` (0% coverage)
- **Files**: `index-page.js`, `jules-page.js`, `profile-page.js`, `queue-page.js`, `sessions-page.js`, `webcapture-page.js`, `oauth-callback-page.js`, `privacy-page.js`
- **Type**: Page-specific initialization
- **Strategy**: Test page setup, module coordination, error boundaries
- **Estimated Tests**: 10-15 tests per page (80-120 total)
- **Complexity**: ⭐⭐⭐ Medium-High (varies by page)

### 5.2 Shared Initialization

#### `src/app.js` (coverage TBD)
- **Type**: Main app entry point
- **Strategy**: Test initialization sequence, error handling
- **Estimated Tests**: 10-12 tests
- **Complexity**: ⭐⭐⭐ Medium-High

#### `src/firebase-init.js` (currently excluded)
- **Strategy**: Test Firebase configuration, connection, error handling
- **Estimated Tests**: 8-10 tests
- **Complexity**: ⭐⭐⭐ Medium-High (external service)

---

## Phase 6: E2E Testing with Playwright (Target: 100% coverage)
**Duration**: 3-4 weeks  
**Goal**: Full user journey coverage

### 6.1 Setup

- Install Playwright: `npm install -D @playwright/test`
- Create `e2e/` test directory
- Configure `playwright.config.js`:
  - Run against local dev server (`npm start`)
  - Multiple browsers (Chromium, Firefox, WebKit)
  - Video recording on failure
  - Screenshot on failure

### 6.2 Critical User Journeys

#### Authentication Flow
- `e2e/auth.spec.js` (5-8 tests)
  - Sign in with GitHub (mock OAuth)
  - Session persistence
  - Sign out
  - Unauthorized access handling

#### Prompt Browsing
- `e2e/prompt-browsing.spec.js` (10-15 tests)
  - Load repository prompts
  - Navigate folder tree
  - Expand/collapse folders
  - Search prompts
  - View prompt content
  - Switch branches
  - Switch repositories

#### Jules Integration
- `e2e/jules-workflow.spec.js` (15-20 tests)
  - Configure API keys
  - Submit prompt to Jules
  - View results
  - Create queue items
  - Schedule queue items
  - Execute queue
  - Handle errors

#### Queue Management
- `e2e/queue-operations.spec.js` (10-15 tests)
  - Create queue item
  - Edit queue item
  - Delete queue item
  - Reorder queue
  - Batch operations
  - Filter/sort

#### Web Capture
- `e2e/webcapture.spec.js` (8-10 tests)
  - Capture web content
  - Edit captured content
  - Save to GitHub
  - Browser extension integration

### 6.3 Visual Regression Testing

- Add `@playwright/test` visual comparison
- Screenshot key UI states:
  - Empty states
  - Loaded states
  - Error states
  - Modal overlays
  - Responsive layouts (mobile, tablet, desktop)

### 6.4 Accessibility Testing

- Add `@axe-core/playwright`
- Test WCAG 2.1 compliance:
  - Color contrast
  - Keyboard navigation
  - Screen reader compatibility
  - Focus management
  - ARIA labels

---

## Testing Strategies by Module Type

### Pure Utilities (Easy)
```javascript
// Example: slug.test.js pattern
describe('utilityFunction', () => {
  it('should handle typical input', () => {
    expect(utilityFunction('input')).toBe('output');
  });
  
  it('should handle edge cases', () => {
    expect(utilityFunction('')).toBe('');
    expect(utilityFunction(null)).toBe('');
  });
});
```

### UI Components (Medium)
```javascript
// Example: dropdown.test.js pattern
describe('UIComponent', () => {
  let container;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should render with correct structure', () => {
    const element = initComponent(container);
    expect(element.querySelector('.component')).toBeTruthy();
  });
  
  it('should handle user interaction', async () => {
    const element = initComponent(container);
    const button = element.querySelector('button');
    await userEvent.click(button);
    expect(element.classList.contains('active')).toBe(true);
  });
});
```

### Async Operations (Medium-High)
```javascript
// Example: github-api.test.js pattern
describe('APIModule', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  
  it('should fetch data successfully', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'value' })
    });
    
    const result = await apiFunction();
    expect(result).toEqual({ data: 'value' });
  });
  
  it('should handle errors', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));
    await expect(apiFunction()).rejects.toThrow('Network error');
  });
});
```

### Complex State Management (High)
```javascript
// Example: jules-queue.test.js pattern (to be created)
describe('StatefulModule', () => {
  beforeEach(() => {
    // Mock Firestore
    vi.mock('../firebase-init.js', () => ({
      db: {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: vi.fn(),
            set: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
          })),
        })),
      },
    }));
  });
  
  it('should manage state transitions', async () => {
    await module.initialize();
    await module.addItem({ id: '1' });
    expect(module.getState()).toMatchObject({ items: [{ id: '1' }] });
  });
});
```

---

## Refactoring Recommendations

### High Priority (Blocking 100% Coverage)

1. **`jules-queue.js`** - Split into smaller modules:
   - `jules-queue-core.js` - Data structures and CRUD
   - `jules-queue-executor.js` - Execution engine
   - `jules-queue-scheduler.js` - Schedule management
   - `jules-queue-sync.js` - Firestore sync
   - `jules-queue-ui.js` - UI coordination

2. **`confirm-modal.js`** - Return testable function:
   ```javascript
   // Current: IIFE initialization
   // Proposed: Export show() function
   export function showConfirmModal(message, options) {
     return new Promise((resolve) => { /* ... */ });
   }
   ```

3. **`prompt-renderer.js`** - Separate concerns:
   - `markdown-converter.js` - Markdown parsing
   - `syntax-highlighter.js` - Code highlighting
   - `link-rewriter.js` - URL processing

### Medium Priority (Improves Testability)

4. **All page scripts** - Extract logic from initialization:
   ```javascript
   // Current: Direct DOM manipulation on load
   // Proposed: Testable setup function
   export function setupPage() {
     // Returns objects/state that can be inspected
   }
   ```

5. **`prompt-list.js`** - Separate tree logic from UI:
   - `tree-builder.js` - Pure tree structure functions
   - `tree-renderer.js` - DOM rendering

---

## Coverage Milestones

| Milestone | Coverage Target | Modules Completed | Tests Added | Timeline |
|-----------|----------------|-------------------|-------------|----------|
| **Phase 1** | 30% | All utils, simple UI | 50-60 tests | Weeks 1-2 |
| **Phase 2** | 50% | Components, modals | 60-80 tests | Weeks 3-5 |
| **Phase 3** | 65% | GitHub integration | 80-100 tests | Weeks 6-8 |
| **Phase 4** | 85% | Jules system | 120-150 tests | Weeks 9-12 |
| **Phase 5** | 95% | Page initialization | 80-100 tests | Weeks 13-14 |
| **Phase 6** | 100% | E2E complete | 50-70 E2E tests | Weeks 15-18 |

**Total Estimated Tests**: 400-500 unit tests + 50-70 E2E tests  
**Total Timeline**: 18-20 weeks (4-5 months)

---

## Maintenance Strategy

### Keep Tests Passing

1. **Run tests before every commit**: `npm test`
2. **CI must be green** before merging PRs
3. **No coverage regressions**: Gradually raise thresholds in `vitest.config.js`

### Test Quality Standards

- **One assertion focus per test** (avoid mega-tests)
- **Descriptive test names**: `should [expected behavior] when [condition]`
- **AAA pattern**: Arrange, Act, Assert
- **Minimal mocking**: Only mock external dependencies
- **Test behavior, not implementation**: Refactoring shouldn't break tests

### Documentation

- Update `CODE_STYLE_GUIDE.md` with new test patterns
- Document complex test setups in comments
- Add JSDoc to test utilities
- Keep this roadmap updated with progress

---

## Success Criteria

### Unit Tests
- ✅ 100% line coverage (or 95%+ with documented exclusions)
- ✅ 100% function coverage
- ✅ 95%+ branch coverage
- ✅ All modules have corresponding test files
- ✅ All tests pass in <10 seconds
- ✅ Zero flaky tests

### E2E Tests
- ✅ All critical user journeys covered
- ✅ Tests run in CI on every PR
- ✅ Cross-browser compatibility verified
- ✅ Visual regression tests in place
- ✅ Accessibility compliance verified

### Process
- ✅ Coverage thresholds enforced in CI
- ✅ New code requires tests (80%+ coverage minimum)
- ✅ Test documentation complete
- ✅ Team trained on testing practices

---

## Resources

### Documentation
- [Vitest Docs](https://vitest.dev/)
- [Playwright Docs](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Kent C. Dodds Testing Blog](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

### Internal
- `docs/CODE_STYLE_GUIDE.md` - Testing patterns and conventions
- `src/tests/setup.js` - Global test configuration
- `vitest.config.js` - Coverage and test settings

---

**Next Action**: Start Phase 1 with `url-params.test.js`
