# PromptSync

Share and amplify your team's AI knowledge.
Hosted for free with GitHub Pages, backed by simple `.md` files.

## Live site

[https://ole-vi.github.io/prompt-sharing/](https://ole-vi.github.io/prompt-sharing/)

## Local development

To test the app locally, you must serve it over HTTP (not open the HTML file directly):

```bash
# From the repo root
python -m http.server 8888
```

Then open **`http://localhost:8888`** in your browser. 

**Important:** Opening `index.html` directly (via `file://` URL) will not work with Firebase authentication. The app must be served over HTTP for GitHub OAuth to function.

## Architecture

This is a zero-build, modular single-page application. All code is plain JavaScript modules (no bundler).

### Folder structure

```
prompt-sharing/
├── index.html           # Main HTML (very lean)
├── firebase-init.js     # Firebase initialization
├── src/
│   ├── app.js          # Main app entry point
│   ├── styles.css      # All CSS
│   ├── modules/        # Feature modules (ES6)
│   │   ├── auth.js     # GitHub OAuth & auth state
│   │   ├── jules.js    # Jules integration & encryption
│   │   ├── github-api.js # GitHub API calls
│   │   ├── prompt-list.js # Tree navigation & list rendering
│   │   ├── prompt-renderer.js # Content display & selection
│   │   └── branch-selector.js # Branch management
│   └── utils/          # Shared utilities
│       ├── constants.js # Constants, regex, storage keys
│       ├── slug.js     # URL slug generation
│       ├── url-params.js # URL parameter parsing
│       └── dom-helpers.js # Common DOM operations
└── prompts/            # Markdown prompts live here
```

## How it works

1. **index.html** loads Firebase SDK + marked.js, then loads `src/app.js` as a module
2. **src/app.js** initializes all modules and wires up event listeners
3. **Modules** are ES6 modules that import utilities and other modules as needed
4. **No build step**: Files are served directly over HTTP

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

Instead of storing the full prompt in this repo, you can point a prompt file at a GitHub Gist. To do this, create a markdown file whose entire body is the raw Gist URL:

```markdown
https://gist.githubusercontent.com/your-username/abc123456789/raw/my-shared-prompt.md
```

When the site loads this file it will fetch the referenced Gist content, cache it, and render that content in place of the URL.

**Limitations**

* The URL must be a publicly readable `gist.githubusercontent.com` raw link. Private gists or GitHub pages that require auth are not supported.
* Only a single URL is supported in the file body; any extra text will be treated as a normal prompt rather than a pointer.
* Updates to the Gist will appear the next time the site fetches that URL. If you change the pointer to a different Gist, update the URL in the prompt file.

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

* Automatic listing of all `.md` files in `/prompts`
* Markdown rendering with headings, lists, code blocks
* One-click Copy prompt button
* Deep linking to specific prompts with `#p=<slug>`
* Automatic emoji tags based on filename keywords (see below)
* No build step, no backend — just static files

## Emoji Titles

The site automatically adds emojis in front of filenames to help visually categorize prompts:

* **🔍** for filenames containing `review`, `pr`, or `rubric`
* **🩹** for filenames containing `bug`, `triage`, or `fix`
* **🧭** for filenames containing `spec`, `design`, or `plan`
* **🧹** for filenames containing `refactor`

If a filename doesn’t match any of these keywords, no emoji is added. Emojis are cosmetic only and don’t affect functionality.

## Notes

* Repo must remain public for GitHub Pages and the GitHub API to fetch the prompts.
* Changes take 1–2 minutes to appear live after pushing to `main`.
* No in-browser editing; prompts are managed via git or the GitHub web interface.

## Development Guide

### Running locally

```bash
cd prompt-sharing
python -m http.server 8888
# Visit http://localhost:8888
```

The dev setup loads modules directly without compilation. Changes are reflected immediately (reload browser).

### Project organization

Each module in `src/modules/` handles one major feature:
- **auth.js**: Firebase authentication state and UI updates
- **github-api.js**: All GitHub API calls (repos, prompts, gists)
- **prompt-list.js**: Tree rendering, sidebar list, search
- **prompt-renderer.js**: Content loading and display
- **branch-selector.js**: Branch listing and switching
- **jules.js**: Jules API integration & key encryption

Utilities in `src/utils/` are shared helpers:
- **constants.js**: Regex patterns, storage keys, emoji mappings, all magic strings
- **slug.js**: URL-safe filename generation
- **url-params.js**: Query string & hash parsing
- **dom-helpers.js**: Reusable DOM operations

### Code style

- ES6 modules with explicit imports/exports
- No transpilation or build step
- Plain JavaScript (no frameworks)
- All external libraries loaded from CDN (marked.js, Firebase)

