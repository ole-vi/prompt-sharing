# PromptSync

Share and amplify your team's AI knowledge.
Hosted for free with GitHub Pages, backed by simple `.md` files.

## Live site

[https://ole-vi.github.io/prompt-sharing/](https://ole-vi.github.io/prompt-sharing/)

## What is PromptSync?

PromptSync is a zero-build web application for managing and sharing AI prompts as markdown files. It provides a browsable library interface with deep linking, GitHub integration, and direct integration with Google's Jules AI assistant. Teams can organize prompts in folders, switch between branches, and send prompts directly to Jules with full context awareness.

## Local development

To test the app locally, you must serve it over HTTP (not open the HTML file directly):

```bash
# From the repo root
python -m http.server 8888
```

Then open **`http://localhost:8888`** in your browser. 

**Important:** Opening `index.html` directly (via `file://` URL) will not work with Firebase authentication. The app must be served over HTTP for GitHub OAuth to function.

## Architecture

This is a zero-build, modular single-page application using plain JavaScript ES6 modules.

### Key Design Principles

* **No Build Step**: Files served directly from GitHub Pages
* **No Framework**: Plain JavaScript with ES6 modules
* **Modular**: Each feature is isolated in its own module
* **Zero Dependencies**: Only CDN-loaded libraries (marked.js, Firebase)
* **Fast**: Caching, lazy loading, and optimized rendering

### Folder structure

```
prompt-sharing/
├── index.html              # Main HTML entry point
├── firebase-init.js        # Firebase SDK initialization
├── firebase.json           # Firebase hosting config
├── firestore.rules         # Firestore security rules
├── src/
│   ├── app.js             # Main application initialization
│   ├── styles.css         # All application styles
│   ├── modules/           # Feature modules (ES6)
│   │   ├── auth.js        # GitHub OAuth & auth state management
│   │   ├── jules.js       # Jules integration, modals, queue system
│   │   ├── jules-api.js   # Jules API client (sources, sessions, activities)
│   │   ├── github-api.js  # GitHub API calls & Gist handling
│   │   ├── prompt-list.js # Sidebar tree navigation & rendering
│   │   ├── prompt-renderer.js # Markdown rendering & display
│   │   ├── branch-selector.js # Branch listing & switching
│   │   ├── subtask-manager.js # Prompt splitting & parsing
│   │   └── status-bar.js  # Status notifications
│   └── utils/             # Shared utilities
│       ├── constants.js   # Config, regex patterns, storage keys
│       ├── slug.js        # URL-safe slug generation
│       ├── url-params.js  # URL parameter parsing
│       ├── dom-helpers.js # DOM manipulation helpers
│       └── title.js       # Title extraction from prompts
├── prompts/               # Markdown prompt files
│   ├── planet/           # Planet repo onboarding
│   ├── myplanet/         # myPlanet repo onboarding
│   └── promptsync/       # PromptSync repo onboarding
└── functions/            # Firebase Cloud Functions (Jules backend)
    ├── index.js
    └── package.json
```

## Adding a new prompt

1. Create a new file inside the `prompts/` folder.

   * Use lowercase filenames with no spaces. Example: `my-new-prompt.md`.
   * File must end with `.md`.

2. Start the file with a first-level heading (`#`) for the title:

   ```markdown
   # My New Prompt

   Prompt instructions go here...
   ```

3. Commit the file to the `main` branch:

   * Either upload directly through the GitHub web UI, or
   * Use git locally:

     ```bash
     git add prompts/my-new-prompt.md
     git commit -m "Add my-new-prompt.md"
     git push
     ```

4. After a minute or two, the live site will auto-refresh to include your new prompt.

### Using a Gist pointer

Instead of storing the full prompt in this repo, you can point a prompt file at a GitHub Gist. Create a markdown file whose entire body is the raw Gist URL:

```markdown
https://gist.githubusercontent.com/your-username/abc123456789/raw/my-shared-prompt.md
```

The app will fetch and cache the Gist content automatically.

**Limitations:**
* Must be a publicly readable `gist.githubusercontent.com` raw link
* Only one URL per file
* Updates to the Gist appear on next fetch

### ChatGPT/Codex Links

If a prompt file contains only a ChatGPT conversation URL (e.g., `https://chatgpt.com/s/...`), the app detects it and provides a clickable link to open the conversation.

## Linking to prompts

Every prompt has its own URL:

```
https://ole-vi.github.io/prompt-sharing/#p=<filename-without-.md>
```

Example:

* File: `prompts/stubs.md`
* Link: [https://ole-vi.github.io/prompt-sharing/#p=stubs](https://ole-vi.github.io/prompt-sharing/#p=stubs)

These links can be shared in Discord, Whatsapp, docs, etc.

## Features

### Core Features

* **Prompt Library Browser**: Navigate prompts organized in folders with a collapsible tree view
* **Markdown Rendering**: Full markdown support with headings, lists, code blocks, and more
* **Deep Linking**: Every prompt has a shareable URL (`#p=slug`)
* **Branch Switching**: Switch between git branches to view different versions of your prompt library
* **Search**: Filter prompts by filename in real-time
* **One-Click Copy**: Copy prompt text to clipboard with a single click
* **Gist Integration**: Reference GitHub Gists as external prompt sources
* **ChatGPT/Codex Links**: Automatically detect and link to ChatGPT conversation URLs
* **Emoji Tags**: Automatic visual categorization based on filename keywords

### GitHub Authentication

* **GitHub OAuth**: Sign in with your GitHub account via Firebase
* **Persistent Sessions**: Stay logged in across browser sessions
* **User Profile**: Access your Jules profile and settings

### Jules API Integration

PromptSync provides deep integration with Google's Jules AI assistant:

#### Try in Jules
* **One-Click Sending**: Send any prompt directly to Jules with the "⚡ Try in Jules" button
* **Repository Context**: Select which GitHub repository Jules should use
* **Branch Selection**: Choose specific branches for Jules to access
* **Custom Titles**: Name your Jules sessions for easy identification
* **Auto-Open**: Automatically open Jules sessions in new tabs

#### Jules Queue System
* **Batch Processing**: Queue multiple prompts to send to Jules
* **Queue Management**: View, edit, and delete queued items
* **Status Tracking**: Monitor pending, processing, and completed items
* **Auto-Open Control**: Choose whether to automatically open Jules tabs

#### Subtask Splitting
* **Intelligent Parsing**: Automatically detect task stubs, numbered lists, or paragraph breaks
* **Manual Splitting**: Define custom `---split---` markers in prompts
* **Preview & Edit**: Review and modify detected subtasks before sending
* **Sequential Execution**: Send subtasks to Jules one at a time or all at once
* **Context Preservation**: Each subtask includes the full prompt context

#### User Profile Page

Click your username after signing in to access:

* **API Key Management**: 
  - Securely store your Jules API key (encrypted in Firestore)
  - Update or delete your stored key
  - Keys are encrypted using AES-GCM with your user ID
* **Connected Repositories**: 
  - View all GitHub repos connected via Jules GitHub App
  - See available branches for each repository
  - Refresh to sync latest connections
* **Recent Sessions**: 
  - Last 10 Jules sessions with titles and status
  - Direct links to Jules sessions and pull requests
  - Status indicators (active, completed, errored)
  - "View All →" to see complete session history
* **Full Sessions History Modal**:
  - Browse all your Jules sessions
  - Search by conversation title or session ID
  - Paginated loading (50 sessions at a time)
  - Session cards with timestamps and links

### Repository Management

* **Multi-Repository Support**: Browse prompts from any GitHub repository
* **URL Parameters**: Share links with custom owner/repo/branch
* **Cache Management**: Automatic caching with session storage
* **Real-Time Updates**: Changes appear 1-2 minutes after pushing to GitHub

## Getting Started with Jules

1. **Sign in**: Click "Sign in with GitHub" in the header
2. **Add API Key**: Click your username → "Add Jules API Key"
   - Get your key from [jules.google.com](https://jules.google.com) → Settings → API Keys
   - Your key is encrypted and stored securely
3. **Browse Prompts**: Navigate the prompt library and find a useful prompt
4. **Send to Jules**: Click "⚡ Try in Jules" on any prompt
5. **Configure**: Select repository and branch for context
6. **Track Sessions**: View your Jules activity in your profile

## Emoji Classification

The app automatically adds emojis to filenames for visual categorization:

* **🔍** - Code review, PR, rubric
* **🩹** - Bug fixes, triage
* **📖** - Documentation, specs, design, explorers
* **🧹** - Refactoring

These are purely cosmetic and based on keywords in the filename.

## Notes

* Repository must remain public for GitHub Pages and API access
* Changes appear live 1–2 minutes after pushing to `main`
* No in-browser editing; manage prompts via git or GitHub web interface
* Browser caching may require hard refresh (Ctrl+Shift+R) after updates
* Firebase configuration required for authentication features
* Jules integration requires valid Jules API key from [jules.google.com](https://jules.google.com)

## Use Cases

- **Team Onboarding**: Repository explorer prompts help new contributors understand codebases
- **Prompt Library**: Centralized collection of reusable AI prompts
- **Knowledge Sharing**: Share effective prompts across your organization  
- **Jules Workflow**: Streamline sending prompts to Jules with proper context
- **Documentation**: Living documentation that AI assistants can consume
- **Best Practices**: Capture and share successful prompt patterns

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test locally with `python -m http.server 8888`
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is open source. See repository for license details.

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

## Development Guide

### Running locally

```bash
cd prompt-sharing
python -m http.server 8888
# Visit http://localhost:8888
```

The dev setup loads modules directly without compilation. Changes are reflected immediately (reload browser).

### Project organization

Each module in `src/modules/` handles one major feature area:

- **auth.js**: Firebase authentication, GitHub OAuth flow, user state management
- **jules.js**: Complete Jules integration including:
  - API key encryption and storage
  - "Try in Jules" workflow with repository/branch selection
  - Queue system for batch processing
  - Subtask splitting and management
  - User profile modal with sessions history
  - All Jules-related modals and UI
- **jules-api.js**: Jules API client wrapper:
  - List connected sources (repositories)
  - Retrieve sessions with filtering and pagination
  - Fetch activity logs
  - Handle API authentication
- **github-api.js**: GitHub API interactions:
  - Fetch repository contents and file trees
  - Load raw markdown files
  - Resolve and fetch GitHub Gists
  - List repository branches
- **prompt-list.js**: Sidebar prompt browser:
  - Tree-based folder navigation
  - Collapsible folders with state persistence
  - Search/filter functionality
  - Active item highlighting
- **prompt-renderer.js**: Content display:
  - Markdown rendering with marked.js
  - Code syntax highlighting
  - Copy to clipboard functionality
  - Deep linking support
- **branch-selector.js**: Branch management:
  - List available branches
  - Switch between branches
  - User/feature branch filtering
- **subtask-manager.js**: Prompt parsing and splitting:
  - Detect task stubs, numbered lists, manual splits
  - Analyze prompt structure
  - Build subtask sequences with context
  - Validate subtask integrity
- **status-bar.js**: User notifications and status messages

Utilities in `src/utils/` provide shared helpers:

- **constants.js**: All configuration, magic strings, regex patterns, emoji mappings, storage keys
- **slug.js**: Generate URL-safe slugs from filenames
- **url-params.js**: Parse URL query strings and hash parameters
- **dom-helpers.js**: Reusable DOM manipulation functions
- **title.js**: Extract titles from markdown content

### Code style

- ES6 modules with explicit imports/exports
- No transpilation or build step required
- Plain JavaScript (no frameworks or libraries except CDN-loaded dependencies)
- Modular architecture with clear separation of concerns
- Async/await for asynchronous operations
- SessionStorage for caching and state persistence
- Firestore for secure data storage (API keys, queue items)

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Markdown**: marked.js (CDN)
- **Authentication**: Firebase Authentication (GitHub OAuth)
- **Database**: Cloud Firestore
- **Backend**: Firebase Cloud Functions (Node.js)
- **Hosting**: GitHub Pages
- **APIs**: GitHub REST API, Jules API (Google)

## Security

- **API Key Encryption**: Jules API keys encrypted using AES-GCM before storage
- **Firestore Rules**: Strict security rules ensuring users can only access their own data
- **GitHub OAuth**: Secure authentication flow via Firebase
- **HTTPS Only**: All API calls and hosting over HTTPS

