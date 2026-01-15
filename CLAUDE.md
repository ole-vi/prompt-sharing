# CLAUDE.md

## Project Overview

PromptRoot is a zero-build, modular single-page application for sharing and managing AI prompts stored as markdown files in GitHub repositories. Key features include:
- Prompt library browser with tree navigation
- Jules AI integration (Google's coding assistant)
- Browser extension for web capture
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
browser-extension/      # Web capture Chrome extension
prompts/                # Markdown prompt library
config/                 # Firebase configuration
docs/                   # Documentation (CODE_STYLE_GUIDE.md, UI_GUIDELINES.md)
```

## Development

### Quick Start
```bash
python -m http.server 8888
# Visit http://localhost:8888/pages/home/index.html
```

### Docker (Full Environment)
```bash
docker-compose up --build
# App: http://localhost:5000
# Emulator UI: http://localhost:4000
```

### Cloud Functions
```bash
cd functions && npm install
npm run serve   # Local testing
npm run deploy  # Deploy to Firebase
```

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
- `julesQueues/{uid}/items` - User queue items

Security rules in `config/firestore/firestore.rules`

## Commands

```bash
npm start              # HTTP server on port 3000
docker-compose up      # Full dev environment
cd functions && npm run deploy  # Deploy functions
```

## Important Files

- `src/utils/constants.js` - All magic strings, regex patterns, config
- `src/firebase-init.js` - Firebase SDK configuration
- `firebase.json` - Firebase hosting & emulator config
- `config/firestore/firestore.rules` - Security rules
