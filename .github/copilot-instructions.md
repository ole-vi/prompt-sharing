# GitHub Copilot Instructions for PromptRoot

## Project Overview

PromptRoot is a zero-build, modular single-page application for sharing and managing AI prompts stored as markdown files in GitHub repositories. Key features include:
- Prompt library browser with tree navigation
- Jules AI integration (Google's coding assistant)
- Browser extension for web capture with GitHub sync
- GitHub OAuth authentication
- Firebase backend for user data

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), no build step, no framework
- **Backend**: Firebase Cloud Functions (Node.js 22)
- **Database**: Firebase Cloud Firestore
- **Auth**: GitHub OAuth via Firebase Authentication
- **Libraries**: marked.js (Markdown), Firebase SDK (CDN-loaded)
- **Hosting**: Firebase Hosting / GitHub Pages

## Core Architectural Rules

### Zero-Build Philosophy
- Plain ES6 modules served directly - NO transpilation, NO build step
- All JavaScript files must be compatible with modern browsers without compilation
- Use CDN-loaded libraries (marked.js, Firebase) - no bundlers

### Module Architecture
- **Named exports only** - NO default exports
- **One feature = One module** - strict separation of concerns
- **No HTML in JavaScript** - use DOM APIs only (createElement, appendChild, etc.)
- **No inline styles** - all styling must be in CSS files
- **Module state as private variables** - encapsulate state within modules

### JavaScript Patterns
- Use async/await for all asynchronous operations
- Constants must be defined in `src/utils/constants.js`
- DOM helpers must be in `src/utils/dom-helpers.js`
- Session caching uses sessionStorage to reduce GitHub API calls

### CSS Architecture
- **Modular CSS** - all styles imported via `src/styles.css`
- **BEM naming convention**: `.component`, `.component--modifier`, `.component__element`
- **CSS variables** - defined in `src/styles/base.css`
- Component styles belong in `src/styles/components/`
- Page-specific styles belong in `src/styles/pages/`

## File Organization

```
pages/                  # Page routes (HTML entry points)
  └── {page}/
      └── {page}.html
src/
  ├── modules/          # Feature modules (auth, API clients, UI components)
  │   └── {feature}.js
  ├── utils/            # Shared utilities
  │   ├── constants.js  # All magic strings, regex patterns, config
  │   ├── dom-helpers.js
  │   └── ...
  └── styles/
      ├── base.css      # Variables and resets
      ├── layout.css    # Grid and responsive rules
      ├── components/   # Component styles
      └── pages/        # Page-specific overrides
functions/              # Firebase Cloud Functions
browser-extension/      # Web capture Chrome extension
prompts/                # Markdown prompt library
webclips/               # User-synced web captures
config/                 # Firebase configuration
```

## Development Commands

### Local Development
```bash
npm start              # Python HTTP server on port 3000 (production Firebase)
# Visit http://localhost:3000
```

### Docker Development (with Firebase Emulators)
```bash
docker-compose up --build
# App: http://localhost:5000
# Emulator UI: http://localhost:4000
```

### Cloud Functions
```bash
cd functions
npm install
npm run serve          # Test locally with emulators
npm run deploy         # Deploy to production Firebase
```

### Environment Detection
- **Port 5000**: Development mode - uses Firebase emulators
- **Port 3000**: Production mode - connects to production Firebase
- Configured in `src/firebase-init.js` via `window.location.port`

## Common Workflows

### Creating a New Page
1. Create HTML file: `pages/{page-name}/{page-name}.html`
2. Create init module: `src/modules/{page-name}-page.js`
3. Import `shared-init.js` and page-specific modules
4. Add page styles: `src/styles/pages/{page-name}.css` (if needed)

### Creating a New Module
1. Create file: `src/modules/{module-name}.js`
2. Use named exports only (NO default exports)
3. Keep module state as private variables
4. Import dependencies from other modules as needed

### Adding Styles
1. Create component CSS: `src/styles/components/{component}.css`
2. Add import to `src/styles.css`
3. Use BEM naming conventions

## Key Modules

| Module | Purpose |
|--------|---------|
| `auth.js` | GitHub OAuth & auth state management |
| `github-api.js` | GitHub REST API wrapper (fetch files, branches, Gists) |
| `jules-api.js` | Jules API client (sources, sessions, activities) |
| `jules-queue.js` | Queue system for batch prompt processing |
| `prompt-renderer.js` | Markdown rendering with marked.js |
| `prompt-list.js` | Sidebar tree navigation & collapsible folders |
| `branch-selector.js` | Branch listing & switching |
| `subtask-manager.js` | Prompt parsing & splitting logic |

## Database Structure

Firestore collections:
- `julesQueues/{uid}/items` - User's Jules queue items (prompt tasks)
- `users/{uid}` - User profile and settings
- `apiKeys/{uid}` - Encrypted API keys (AES-GCM encryption)

Security rules: `config/firestore/firestore.rules`
- Users can only read/write their own documents
- Authentication required for all operations

## Important Conventions

### File Naming
- Use lowercase with hyphens: `my-module.js`, `my-component.css`
- Module files: `{feature}.js`
- Page init files: `{page}-page.js`
- CSS files: `{component}.css`

### Code Style
- Use meaningful variable names (no single letters except loop counters)
- Prefer const over let; avoid var
- Use template literals for string interpolation
- Comment only when necessary (code should be self-documenting)

### Runtime Behaviors
- **Async Firebase Loading**: Wait for `firebase.apps.length` before initializing
- **Port-based Config**: Firebase init checks port for emulator vs production
- **Session Caching**: API responses cached in sessionStorage
- **Auth State**: Persists in localStorage, checked on every page load

## Testing & Validation

### Before Committing Changes
1. Test locally: `npm start` or `docker-compose up`
2. Verify no console errors in browser DevTools
3. Test affected features manually
4. Verify Firebase authentication if auth-related changes
5. Check that no build artifacts are committed

### Firebase Functions
- Test with emulators: `cd functions && npm run serve`
- Verify function logs in emulator UI
- Deploy only after local validation

## Security Guidelines

- **Never commit secrets** - use environment variables
- **API Key Encryption** - Jules API keys use AES-GCM before Firestore storage
- **Firestore Rules** - enforce user-only data access
- **GitHub OAuth** - secure authentication via Firebase
- **HTTPS Only** - all API calls and hosting over HTTPS

## File Import Rules

- Always use relative paths for local modules: `import { auth } from './auth.js'`
- CDN libraries loaded in HTML: Firebase SDK, marked.js
- No npm packages in frontend code (backend Cloud Functions can use npm)

## Important Files to Know

- `src/utils/constants.js` - All magic strings, regex patterns, config
- `src/firebase-init.js` - Firebase SDK configuration & environment detection
- `firebase.json` - Firebase hosting & emulator config
- `config/firestore/firestore.rules` - Firestore security rules
- `src/shared-init.js` - Shared initialization for all pages
- `src/styles.css` - CSS aggregator file (import order matters)

## What NOT to Do

- ❌ Don't use build tools, bundlers, or transpilers
- ❌ Don't use default exports
- ❌ Don't add framework dependencies (React, Vue, etc.)
- ❌ Don't write HTML strings in JavaScript
- ❌ Don't use inline styles
- ❌ Don't commit node_modules or build artifacts
- ❌ Don't modify Firestore rules without understanding security implications
- ❌ Don't add new npm dependencies to frontend (backend only)

## When Working on Issues

1. **Understand context**: Read related modules and understand data flow
2. **Minimal changes**: Make the smallest possible change to solve the problem
3. **Test thoroughly**: Manually verify changes work in browser
4. **Check console**: Ensure no JavaScript errors
5. **Verify imports**: Ensure all imports use correct relative paths
6. **Follow patterns**: Match existing code style and architecture
7. **Document if needed**: Update this file if architectural changes are made
