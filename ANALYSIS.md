# Application Analysis: PromptSync

## Overview
PromptSync is a zero-build, modular single-page application (SPA) hosted on GitHub Pages. It is designed to share and amplify AI knowledge using simple markdown (`.md`) files. It integrates with GitHub for authentication and content source, and with the Google Jules API for executing AI tasks.

## Architecture
- **Zero-Build**: The application uses native ES6 modules loaded directly by the browser. There is no build step (no Webpack, no Babel).
- **Hosting**: GitHub Pages.
- **Backend**:
  - **Firebase Authentication**: Handles user sign-in via GitHub OAuth.
  - **Firestore**: Stores user-specific data like Jules API keys and task queues.
  - **GitHub API**: Fetches repository content (prompts), branches, and user data.
  - **Google Cloud Functions**: A proxy (`runjuleshttp`) handles communication with the Jules API.

## Core Modules (`src/modules/`)
- **`app.js`**: The main entry point. It initializes other modules, handles URL routing (hash-based), and sets up global event listeners.
- **`auth.js`**: Manages Firebase authentication state and updates the UI accordingly.
- **`jules.js`**: The most complex module. It handles:
  - Integration with the Jules API (via proxy).
  - API Key management (encryption/storage in Firestore).
  - Task execution and queuing.
  - UI for "Try in Jules" modal, key management, and session history.
- **`jules-api.js`**: A client library for interacting with the Jules API endpoints (sources, sessions, activities).
- **`subtask-manager.js`**: Provides logic to split large prompts into subtasks (using task stubs, numbered lists, or paragraphs) for sequential execution.
- **`prompt-list.js`**: Renders the file tree navigation for prompts.
- **`prompt-renderer.js`**: Fetches and displays the selected markdown prompt using `marked.js`.
- **`branch-selector.js`**: Allows users to switch between branches of the connected repository.

## Key Features
1. **Prompt Management**:
   - Prompts are stored as `.md` files in the `prompts/` directory.
   - Users can browse prompts via a tree view.
   - Supports "Gist pointers" to load content from external Gists.
   - Emojis are automatically added to titles based on keywords (e.g., "review", "bug").

2. **Jules Integration**:
   - **Authentication**: Users must sign in with GitHub to access Jules features.
   - **API Key Security**: Users provide their Jules API key, which is encrypted client-side before being stored in Firestore.
   - **Execution**: Users can "Try in Jules" directly from a prompt. This triggers a Cloud Function.
   - **Queuing**: Users can queue tasks to run later. This is backed by Firestore.
   - **Subtask Splitting**: Large prompts can be analyzed and split into multiple subtasks to be run sequentially.

3. **Session History**:
   - Users can view their recent Jules sessions, status, and link to resulting Pull Requests.

## Data Flow
1. **Initialization**: `index.html` loads Firebase SDKs and `src/app.js`. `app.js` initializes modules.
2. **Navigation**: URL hash changes (e.g., `#p=my-prompt`) trigger `loadPrompts` and `selectBySlug`.
3. **Content Loading**: `prompt-renderer.js` fetches the raw markdown content from the GitHub repository (via GitHub API or raw content URL).
4. **Jules Interaction**:
   - User clicks "Try in Jules".
   - `jules.js` checks for a stored API key.
   - If present, it opens the environment selection modal (repo/branch).
   - Upon confirmation, it calls `callRunJulesFunction` which hits the Cloud Function proxy.
   - The session URL is returned and opened in a new tab.

## Local Development
- Requires serving over HTTP (e.g., `python -m http.server`) to support Firebase Auth.
- No build commands needed.
