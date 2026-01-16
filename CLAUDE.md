# CLAUDE.md

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

## Project Structure

```
pages/                  # Page routes (HTML entry points)
src/
  ├── modules/          # Feature modules (auth, API clients, UI components)
  ├── utils/            # Shared utilities (constants, helpers)
  └── styles/           # CSS modules (base, components, pages)
functions/              # Firebase Cloud Functions
browser-extension/      # Web capture Chrome extension (GitHub OAuth for syncing clips)
prompts/                # Markdown prompt library
webclips/               # User-synced web captures (per-user folders: webclips/{username}/)
config/                 # Firebase configuration
docs/                   # Documentation (CODE_STYLE_GUIDE.md, UI_GUIDELINES.md)
```

## Development

### Quick Start
```bash
npm start
# Visit http://localhost:3000
```
Note: `npm start` runs a Python HTTP server on port 3000.

### Docker (Full Environment with Emulators)
```bash
docker-compose up --build
# App: http://localhost:5000
# Emulator UI: http://localhost:4000
```

### Environment Detection
The app detects the environment based on the port:
- **Port 5000**: Development mode - uses Firebase emulators (Firestore, Functions, Auth)
- **Port 3000**: Production mode - connects to production Firebase services

This is configured in `src/firebase-init.js` which checks `window.location.port`.

### Cloud Functions
```bash
cd functions && npm install
npm run serve   # Local testing with emulators
npm run deploy  # Deploy to production Firebase
```

## Runtime Behaviors

- **Async Firebase Loading**: Firebase SDK loads asynchronously; modules wait for `firebase.apps.length` before initializing
- **Port-based Config**: Firebase init checks port to determine emulator vs production endpoints
- **Session Caching**: Uses sessionStorage for API responses to reduce GitHub API calls
- **Auth State**: Authentication state persists in localStorage; checked on every page load

## Coding Conventions

### Architecture Rules
- **Zero-build**: Plain ES6 modules served directly, no transpilation
- **No HTML in JavaScript**: Use DOM APIs only
- **No inline styles**: CSS files only
- **Named exports only**: No default exports
- **One feature = One module**: Separated concerns

### JavaScript Patterns
- All async operations use async/await
- Module state as private variables
- Constants in `src/utils/constants.js`
- DOM helpers in `src/utils/dom-helpers.js`

### CSS Architecture
- Modular CSS imported via `src/styles.css`
- BEM naming: `.component`, `.component--modifier`, `.component__element`
- CSS variables defined in `src/styles/base.css`
- Component styles in `src/styles/components/`

### File Organization
- Page initialization files in `src/modules/[page]-page.js`
- Shared initialization in `src/shared-init.js`
- Firebase config in `src/firebase-init.js`

## Common Development Workflows

### Creating a New Page
1. Create HTML file in `pages/{page-name}/{page-name}.html`
2. Create initialization module `src/modules/{page-name}-page.js`
3. Import shared-init.js and page-specific modules
4. Add page styles in `src/styles/pages/{page-name}.css` if needed

### Creating a New Module
1. Create file in `src/modules/{module-name}.js`
2. Use named exports only (no default exports)
3. Keep module state as private variables
4. Import from other modules as needed

### Adding Styles
1. Create component CSS in `src/styles/components/{component}.css`
2. Add import to `src/styles.css`
3. Use BEM naming conventions

## Key Modules

| Module | Purpose |
|--------|---------|
| `auth.js` | GitHub OAuth & auth state |
| `github-api.js` | GitHub REST API wrapper |
| `jules-api.js` | Jules API client |
| `jules-queue.js` | Queue system for batch prompts |
| `prompt-renderer.js` | Markdown rendering |
| `prompt-list.js` | Sidebar tree navigation |

## Database

Firestore collections:
- `julesQueues/{uid}/items` - User's Jules queue items (prompt tasks)
- `users/{uid}` - User profile and settings
- `apiKeys/{uid}` - Encrypted API keys (AES-GCM encryption)

Security rules: `config/firestore/firestore.rules`
- Users can only read/write their own documents
- Authentication required for all operations

## Commands

```bash
npm start              # Python HTTP server on port 3000 (production Firebase)
docker-compose up      # Full dev environment with emulators (port 5000)
cd functions && npm run serve   # Test functions locally
cd functions && npm run deploy  # Deploy functions to Firebase
```

## Important Files

- `src/utils/constants.js` - All magic strings, regex patterns, config
- `src/firebase-init.js` - Firebase SDK configuration & environment detection
- `firebase.json` - Firebase hosting & emulator config
- `config/firestore/firestore.rules` - Firestore security rules
