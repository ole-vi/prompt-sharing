# CLAUDE.md - AI Assistant Guide for PromptRoot

**Version:** 1.0
**Last Updated:** January 15, 2026

This document helps AI assistants (Claude, ChatGPT, etc.) understand the PromptRoot codebase and work effectively on it. Read this FIRST before making changes.

---

## Table of Contents

1. [Critical Context](#critical-context)
2. [Recent Breaking Changes](#recent-breaking-changes)
3. [Before Making Any Changes](#before-making-any-changes)
4. [Architecture Quick Reference](#architecture-quick-reference)
5. [Common Pitfalls & Gotchas](#common-pitfalls--gotchas)
6. [Testing Checklist](#testing-checklist)
7. [Code Modification Patterns](#code-modification-patterns)
8. [API Integration Notes](#api-integration-notes)
9. [Security Considerations](#security-considerations)
10. [Quick Reference Links](#quick-reference-links)

---

## Critical Context

### What is PromptRoot?

PromptRoot is a **zero-build** web application for managing and sharing AI prompts. It's a static site hosted on GitHub Pages with Firebase backend integration.

**Key Characteristics:**
- **Zero-build**: No webpack, no npm build, no transpilation
- **Vanilla JavaScript**: ES6 modules only, no frameworks
- **Static hosting**: GitHub Pages + Firebase Cloud Functions
- **Real-time sync**: Changes go live 1-2 minutes after git push

### Project Philosophy

1. **File Type Segregation**: NEVER mix HTML in JavaScript, CSS in JavaScript, or JavaScript in HTML
2. **No Build Step**: All code runs directly in the browser
3. **Modular Architecture**: Each feature is isolated in its own module
4. **Progressive Enhancement**: Core functionality works without JavaScript

---

## Recent Breaking Changes

**IMPORTANT: As of January 14, 2026, these breaking changes were introduced:**

### 1. API Response Format Changed (Commit e257cb4)

**File:** `src/modules/github-api.js:149`

```javascript
// OLD (BROKEN):
return { data: files, etag: result.etag };

// NEW (CORRECT):
return { files, etag: result.etag };
```

**Impact:** Any code calling `listPromptsViaTrees()` expecting `.data.files` will break. Must use `.files` instead.

**Action Required:** Search for all usages of `listPromptsViaTrees()` and verify they access `.files` not `.data`

### 2. Prompt Directory Reorganization (Commit 4ba08f4)

**Deleted:**
- `prompts/myplanet/`
- `prompts/planet/`
- `prompts/promptsync/`

**Moved:**
- `prompts/promptsync/*` → `prompts/tutorial/promptroot (meta)/`
- `prompts/templates/*` → `prompts/tutorial/templates/`

**Impact:** Any hardcoded paths to these directories will fail.

**Action Required:** Verify no code references these old paths.

### 3. Jules API Pagination Added (Commit 1c442c6)

**File:** `src/modules/jules-api.js`

The `loadJulesProfileInfo()` function now fetches ALL repository pages, not just the first page.

**Impact:** May be slower for users with hundreds of repositories.

**Action Required:** Monitor performance, consider adding loading indicators.

### 4. Browser Extension Enhancements (Commit ef0a85c)

Major UI/UX improvements to browser extension (+324 lines).

**Impact:** New file `browser-extension/icon-helpers.js` added, manifest updated.

**Action Required:** Test in Chrome, Firefox, and Edge before deploying.

---

## Before Making Any Changes

### ALWAYS Do This First:

1. **Read the file** you're about to modify using the Read tool
2. **Check dependencies** by searching for imports/usages of functions you'll change
3. **Review recent commits** to understand context: `git log --oneline -10`
4. **Read relevant docs**:
   - [CODE_STYLE_GUIDE.md](docs/CODE_STYLE_GUIDE.md) for JavaScript patterns
   - [UI_GUIDELINES.md](docs/UI_GUIDELINES.md) for CSS/UI patterns
   - [README.md](README.md) for architecture overview

### NEVER Do This:

- ❌ Don't guess at file contents - always read first
- ❌ Don't create new files unless absolutely necessary - edit existing files
- ❌ Don't add build tools, transpilers, or bundlers
- ❌ Don't mix HTML/CSS/JavaScript in single files
- ❌ Don't use frameworks (React, Vue, etc.)
- ❌ Don't add npm dependencies
- ❌ Don't create markdown documentation files proactively (README, docs, etc.) unless explicitly requested

---

## Architecture Quick Reference

### Directory Structure

```
promptroot/
├── pages/                      # HTML pages (routed views)
│   ├── home/index.html         # Main prompt library
│   ├── jules/jules.html        # Jules session management
│   ├── queue/queue.html        # Task queue
│   ├── sessions/sessions.html  # Session history
│   └── profile/profile.html    # User profile
├── src/
│   ├── pages/                  # Page initialization scripts
│   │   ├── index-page.js
│   │   ├── jules-page.js
│   │   └── profile-page.js
│   ├── modules/                # Feature modules
│   │   ├── auth.js             # GitHub OAuth via Firebase
│   │   ├── github-api.js       # GitHub API client
│   │   ├── jules-api.js        # Jules API client
│   │   ├── jules.js            # Jules integration & modals
│   │   ├── prompt-list.js      # Sidebar navigation
│   │   ├── prompt-renderer.js  # Markdown rendering
│   │   └── status-bar.js       # User notifications
│   └── utils/                  # Pure functions
│       ├── constants.js        # ALL magic strings go here
│       ├── dom-helpers.js      # DOM manipulation
│       ├── session-cache.js    # Session storage
│       └── slug.js             # URL slugification
├── prompts/                    # Markdown prompt library
│   └── tutorial/               # Onboarding prompts
├── webclips/                   # User-synced web captures
├── browser-extension/          # Web capture extension
└── functions/                  # Firebase Cloud Functions
    └── index.js                # OAuth proxy + backend
```

### Module Responsibilities

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| `auth.js` | Firebase auth, GitHub OAuth | `signInWithGitHub()`, `signOut()` |
| `github-api.js` | GitHub API calls | `listPromptsViaTrees()`, `fetchRawFile()` |
| `jules-api.js` | Jules API client | `listJulesSources()`, `listJulesSessions()` |
| `jules.js` | Jules integration UI | `openJulesModal()`, Queue management |
| `prompt-list.js` | Sidebar tree view | `renderFileTree()`, `filterPrompts()` |
| `prompt-renderer.js` | Markdown display | `renderPrompt()`, `copyToClipboard()` |
| `status-bar.js` | User notifications | `showMessage()`, `setProgress()` |

### Page Initialization Pattern

Every HTML page follows this pattern:

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="../../src/styles.css" />
</head>
<body>
  <!-- Page content here -->

  <!-- Shared initialization (header, Firebase) -->
  <script type="module" src="../../src/shared-init.js"></script>

  <!-- Page-specific initialization -->
  <script type="module" src="../../src/pages/example-page.js"></script>
</body>
</html>
```

**Critical:** Pages wait for shared components (header) before initializing.

---

## Common Pitfalls & Gotchas

### 1. File URLs Don't Work

**Problem:** Opening `index.html` directly (`file://`) breaks Firebase authentication.

**Solution:** ALWAYS serve over HTTP:
```bash
python -m http.server 8888
# Visit http://localhost:8888/pages/home/index.html
```

### 2. Changes Don't Appear

**Possible Causes:**
- Browser cache (try Ctrl+Shift+R hard refresh)
- GitHub Pages takes 1-2 minutes to update after push
- SessionStorage cache needs clearing

**Solution:** Clear browser cache and sessionStorage:
```javascript
sessionStorage.clear();
location.reload();
```

### 3. API Rate Limits

**GitHub API:** 60 requests/hour (unauthenticated), 5000/hour (authenticated)

**Solution:**
- Use ETags for caching (already implemented in `github-api.js`)
- Check `X-RateLimit-Remaining` header when debugging

### 4. Firebase Emulator vs Production

**Problem:** Code works in Docker but fails in production (or vice versa).

**Solution:** Check `firebase-init.js` - emulators use different endpoints:
- Production: `firestore.googleapis.com`
- Emulator: `localhost:8080`

### 5. Module Import Paths

**Problem:** Import paths must be exact, including `.js` extension.

```javascript
// ❌ WRONG:
import { auth } from '../modules/auth';

// ✅ CORRECT:
import { auth } from '../modules/auth.js';
```

### 6. CSS Class Naming Conflicts

**Problem:** Global CSS can conflict across pages.

**Solution:** Use BEM naming or page-specific prefixes:
```css
/* Good */
.prompt-list__item { }
.jules-modal__header { }

/* Avoid */
.item { }
.header { }
```

### 7. Async Initialization Race Conditions

**Problem:** Accessing Firebase before it's initialized.

**Solution:** Use `waitForFirebase()` from `shared-init.js`:
```javascript
import { waitForFirebase } from '../shared-init.js';

waitForFirebase(() => {
  window.auth.onAuthStateChanged((user) => {
    // Safe to use Firebase here
  });
});
```

### 8. SessionStorage Keys Colliding

**Problem:** Different features overwriting each other's cache.

**Solution:** Use namespaced keys from `constants.js`:
```javascript
import { STORAGE_KEYS } from '../utils/constants.js';

// Good - namespaced
sessionStorage.setItem(STORAGE_KEYS.JULES_SESSIONS, data);

// Bad - generic key
sessionStorage.setItem('sessions', data);
```

---

## Testing Checklist

### Before Committing:

- [ ] **Local Testing:** Served with `python -m http.server 8888`
- [ ] **Hard Refresh:** Tested with cache cleared (Ctrl+Shift+R)
- [ ] **Console:** No JavaScript errors in browser console
- [ ] **Authentication:** Tested both signed-in and signed-out states
- [ ] **Responsiveness:** Tested on mobile viewport (DevTools)
- [ ] **Cross-Browser:** Tested in Chrome/Firefox (if UI changes)

### For API Changes:

- [ ] **Rate Limits:** Verified no excessive API calls
- [ ] **Error Handling:** Tested with network offline
- [ ] **Loading States:** UI shows loading indicators
- [ ] **Cache Invalidation:** Old cached data doesn't cause issues

### For Browser Extension:

- [ ] **Chrome:** Tested in Chrome (manifest v3)
- [ ] **Firefox:** Tested in Firefox (if applicable)
- [ ] **OAuth Flow:** GitHub login/logout works
- [ ] **Permissions:** Extension has required permissions

### For Jules Integration:

- [ ] **API Key:** Tested with valid and invalid keys
- [ ] **Repository Selection:** Multi-repo scenarios work
- [ ] **Queue System:** Items queue and execute properly
- [ ] **Session Links:** Links to Jules sessions work

---

## Code Modification Patterns

### Pattern 1: Adding a New Feature

1. **Read relevant files** to understand current implementation
2. **Check if module exists** - don't create new files unnecessarily
3. **Update constants** in `src/utils/constants.js` for any magic strings
4. **Add to existing module** or create new module in `src/modules/`
5. **Import in page** initialization file (`src/pages/`)
6. **Add styles** to appropriate CSS file in `src/styles/components/`
7. **Test thoroughly** using checklist above

### Pattern 2: Fixing a Bug

1. **Reproduce the bug** locally first
2. **Search for related code** using grep/search tools
3. **Read surrounding context** - don't just fix the immediate line
4. **Check for similar patterns** elsewhere in codebase
5. **Fix root cause** not symptoms
6. **Test edge cases** that might trigger same issue

### Pattern 3: Refactoring Code

1. **Understand current behavior** completely before changing
2. **Search for all usages** of functions you're modifying
3. **Make small, incremental changes** - don't refactor everything at once
4. **Test after each change** to isolate breakages
5. **Update comments/docs** if behavior changes

### Pattern 4: Adding API Integration

1. **Check existing API modules** (`github-api.js`, `jules-api.js`)
2. **Follow established patterns** for error handling and caching
3. **Add base URL** to `constants.js`
4. **Implement caching** using `session-cache.js`
5. **Add loading states** in UI
6. **Handle errors gracefully** with `status-bar.js`

### Pattern 5: UI Changes

1. **Read UI_GUIDELINES.md** first
2. **Use existing components** from `src/styles/components/`
3. **Never inline styles** - always use CSS classes
4. **Use createElement** from `dom-helpers.js` (no HTML strings)
5. **Test responsiveness** at mobile/tablet/desktop sizes
6. **Maintain accessibility** (keyboard navigation, ARIA labels)

---

## API Integration Notes

### GitHub API

**Base URL:** `https://api.github.com`

**Key Endpoints Used:**
- `/repos/{owner}/{repo}/contents/{path}` - List files
- `/repos/{owner}/{repo}/git/trees/{sha}?recursive=1` - Full tree
- `/repos/{owner}/{repo}/branches` - List branches
- `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}` - Raw files

**Caching Strategy:**
- Uses ETags for conditional requests
- Cached in sessionStorage via `session-cache.js`
- Cache expires after 5 minutes for most data

**Error Handling:**
```javascript
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  return await response.json();
} catch (error) {
  console.error('GitHub API failed:', error);
  statusBar.showMessage('Failed to load from GitHub', { timeout: 3000 });
  throw error;
}
```

### Jules API

**Base URL:** Defined in `constants.js` as `JULES_API_BASE`

**Authentication:** Bearer token in `Authorization` header

**Key Endpoints:**
- `/sources` - List connected repositories (supports pagination)
- `/sessions` - List Jules sessions
- `/sessions/{id}/activities` - Session activity logs

**Pagination:**
```javascript
// Jules API uses pageToken for pagination
let allItems = [];
let pageToken = null;
do {
  const response = await fetch(url + (pageToken ? `?pageToken=${pageToken}` : ''));
  const data = await response.json();
  allItems.push(...data.items);
  pageToken = data.nextPageToken;
} while (pageToken);
```

**Critical:** The `loadJulesProfileInfo()` function now fetches ALL pages. Monitor performance.

### Firebase Cloud Functions

**Location:** `functions/index.js`

**Purpose:** OAuth proxy and backend services

**Key Functions:**
- `githubOAuthCallback` - Handles GitHub OAuth redirect
- Jules API key encryption/decryption
- Firestore security rules enforcement

**Testing:**
- Use Firebase emulators: `firebase emulators:start`
- Or Docker: `docker-compose up --build`

---

## Security Considerations

### 1. API Key Storage

**Jules API keys are encrypted** using AES-GCM before storing in Firestore.

**Implementation:** See `functions/index.js` for encryption logic.

**Never:**
- ❌ Store API keys in localStorage unencrypted
- ❌ Log API keys to console
- ❌ Include API keys in error messages
- ❌ Commit API keys to git

### 2. Firestore Security Rules

**Location:** `config/firestore/firestore.rules`

**Key Rules:**
- Users can only access their own data
- API keys are write-once (update requires delete+create)
- Queue items are user-scoped

**Before modifying Firestore:**
1. Read `firestore.rules` to understand permissions
2. Test rules in Firebase console
3. Never bypass security rules in client code

### 3. XSS Prevention

**Markdown Rendering:** Uses `marked.js` library (sanitizes by default).

**User Input:** Always escape when displaying:
```javascript
// Good - escaped
element.textContent = userInput;

// Bad - XSS risk
element.innerHTML = userInput;
```

### 4. GitHub OAuth

**Flow:**
1. User clicks "Sign in with GitHub"
2. Redirected to GitHub OAuth
3. GitHub redirects to `oauth-callback.html`
4. Callback exchanges code for token via Firebase Functions
5. Firebase Authentication session created

**Never:**
- ❌ Handle OAuth tokens in client-side JavaScript directly
- ❌ Store OAuth tokens in localStorage
- ❌ Bypass Firebase authentication

### 5. CORS and CSP

**GitHub Pages:** Automatically serves over HTTPS.

**Content Security Policy:** Defined in HTML `<meta>` tags if needed.

**CORS:** GitHub API and Jules API both support CORS.

---

## Quick Reference Links

### Essential Reading (Read These First):
1. [CODE_STYLE_GUIDE.md](docs/CODE_STYLE_GUIDE.md) - JavaScript patterns
2. [UI_GUIDELINES.md](docs/UI_GUIDELINES.md) - CSS and UI patterns
3. [README.md](README.md) - Project overview

### Deployment & Setup:
4. [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Deployment instructions
5. [QUICKSTART.md](QUICKSTART.md) - User guide
6. [DOCKER.md](docs/DOCKER.md) - Docker development setup

### Component Documentation:
7. [browser-extension/README.md](browser-extension/README.md) - Extension docs

### External References:
- [Firebase Documentation](https://firebase.google.com/docs)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [marked.js Documentation](https://marked.js.org/)

---

## When You're Stuck

### Debugging Checklist:

1. **Check browser console** for JavaScript errors
2. **Check Network tab** for failed API requests
3. **Check Application tab** for sessionStorage/localStorage values
4. **Search codebase** for similar patterns: `grep -r "pattern" src/`
5. **Read recent commits** for context: `git log --oneline -20`
6. **Check Firebase console** for Firestore data issues
7. **Test in incognito** to rule out cache issues
8. **Review this CLAUDE.md** for common pitfalls

### Getting Context:

```bash
# Find all usages of a function
grep -r "functionName" src/

# Find all files importing a module
grep -r "from.*module-name" src/

# See recent changes to a file
git log -p --follow src/modules/file.js

# See what changed in last 10 commits
git log --oneline -10 --stat
```

---

## Final Reminders

### DO:
✅ Read files before modifying them
✅ Follow established patterns in codebase
✅ Use helpers from `dom-helpers.js` and `constants.js`
✅ Add clear comments explaining "why" not "what"
✅ Test thoroughly before committing
✅ Keep changes minimal and focused

### DON'T:
❌ Mix HTML/CSS/JavaScript in single files
❌ Add build tools or npm dependencies
❌ Create new files when existing ones can be edited
❌ Guess at implementation - read existing code first
❌ Make sweeping refactors without understanding impact
❌ Commit without testing locally

---

**Questions or Issues?**

If you encounter something not covered in this guide:
1. Search existing code for similar patterns
2. Check CODE_STYLE_GUIDE.md and UI_GUIDELINES.md
3. Review recent git commits for context
4. Ask the user for clarification

**Keep this document updated** as the codebase evolves. Add new gotchas, patterns, and breaking changes as they're discovered.

---

**Document Maintenance:**
- Update "Recent Breaking Changes" section after major commits
- Add new pitfalls to "Common Pitfalls & Gotchas" when discovered
- Keep "Testing Checklist" current with new requirements
- Version and date this document at the top when making changes
