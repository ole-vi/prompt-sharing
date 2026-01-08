# Refactoring Tasks Report

This document contains 15 granular refactoring opportunities focused on naming consistency, file organization, and structural improvements. Tasks are designed to minimize merge conflicts when executed in parallel.

---

### Rename browser extension auth module for clarity

The browser extension uses `github-auth.js` but the main app also has `auth.js` in modules. Renaming to `auth-handler.js` clarifies this is handler-pattern code and distinguishes it from the main app's auth module.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=175 path=browser-extension/github-auth.js git_url="https://github.com/promptroot/promptroot/blob/main/browser-extension/github-auth.js#L1-L175"}

:::task-stub{title="Rename github-auth.js to auth-handler.js"}
1. Rename `browser-extension/github-auth.js` to `browser-extension/auth-handler.js`
2. Update reference in `browser-extension/popup.js` script tag or import
3. Update reference in `browser-extension/manifest.json` if listed
4. Verify extension loads correctly after rename
:::

---

### Rename browser extension sync module for consistency

The `github-sync.js` file follows a different naming pattern than other extension files. Renaming to `sync-handler.js` establishes a consistent handler suffix pattern within the extension.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=136 path=browser-extension/github-sync.js git_url="https://github.com/promptroot/promptroot/blob/main/browser-extension/github-sync.js#L1-L136"}

:::task-stub{title="Rename github-sync.js to sync-handler.js"}
1. Rename `browser-extension/github-sync.js` to `browser-extension/sync-handler.js`
2. Update reference in `browser-extension/popup.js` if imported
3. Update reference in `browser-extension/popup.html` script tag
4. Verify sync functionality works after rename
:::

---

### Align CSS filename with corresponding JS module

The CSS file `jules-profile.css` styles the jules profile modal, but the JS module is named `jules-profile-modal.js`. Aligning the CSS filename improves discoverability.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=50 path=src/styles/components/jules-profile.css git_url="https://github.com/promptroot/promptroot/blob/main/src/styles/components/jules-profile.css#L1-L50"}

:::task-stub{title="Rename jules-profile.css to jules-profile-modal.css"}
1. Rename `src/styles/components/jules-profile.css` to `src/styles/components/jules-profile-modal.css`
2. Update @import statement in `src/styles.css` if present
3. Update any HTML link tags referencing this file
4. Verify jules profile modal styling renders correctly
:::

---

### Rename home.css to match page module naming convention

The pages directory uses `index-page.js` for the home page module, but CSS uses `home.css`. Renaming to `index.css` creates consistency between JS and CSS naming.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=50 path=src/styles/pages/home.css git_url="https://github.com/promptroot/promptroot/blob/main/src/styles/pages/home.css#L1-L50"}

:::task-stub{title="Rename home.css to index.css"}
1. Rename `src/styles/pages/home.css` to `src/styles/pages/index.css`
2. Update @import in parent stylesheet if applicable
3. Update link tag in `index.html` if directly referenced
4. Verify home page styles load correctly
:::

---

### Standardize slug utility filename with utils suffix

The utils directory has inconsistent naming: `dom-helpers.js`, `checkbox-helpers.js` use suffixes while `slug.js` does not. Adding `-utils` suffix improves consistency.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=11 path=src/utils/slug.js git_url="https://github.com/promptroot/promptroot/blob/main/src/utils/slug.js#L1-L11"}

:::task-stub{title="Rename slug.js to slug-utils.js"}
1. Rename `src/utils/slug.js` to `src/utils/slug-utils.js`
2. Update import in `src/modules/prompt-list.js` line 3
3. Update import in `src/modules/prompt-renderer.js` line 3
4. Search for any other imports of slug.js and update
5. Verify slugify and unslugify functions work correctly
:::

---

### Standardize title utility filename with utils suffix

Following the same pattern as slug.js, the `title.js` utility should be renamed to `title-utils.js` for consistency with the emerging utils naming convention.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=9 path=src/utils/title.js git_url="https://github.com/promptroot/promptroot/blob/main/src/utils/title.js#L1-L9"}

:::task-stub{title="Rename title.js to title-utils.js"}
1. Rename `src/utils/title.js` to `src/utils/title-utils.js`
2. Search codebase for imports of title.js
3. Update all import statements to reference title-utils.js
4. Verify extractTitleFromPrompt function works correctly
:::

---

### Rename header module to reflect loader pattern

The `header.js` module contains `loadHeader()` function that fetches and injects HTML. Renaming to `header-loader.js` better describes its single responsibility.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=131 path=src/modules/header.js git_url="https://github.com/promptroot/promptroot/blob/main/src/modules/header.js#L1-L131"}

:::task-stub{title="Rename header.js to header-loader.js"}
1. Rename `src/modules/header.js` to `src/modules/header-loader.js`
2. Update import in `src/modules/page-init.js` line 2
3. Search for any other imports and update
4. Verify header loading works on all pages
:::

---

### Rename navbar module to reflect loader pattern

The `navbar.js` module contains `loadNavbar()` function that fetches and injects navbar HTML. Consistent with header-loader pattern, rename to `navbar-loader.js`.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=23 path=src/modules/navbar.js git_url="https://github.com/promptroot/promptroot/blob/main/src/modules/navbar.js#L1-L23"}

:::task-stub{title="Rename navbar.js to navbar-loader.js"}
1. Rename `src/modules/navbar.js` to `src/modules/navbar-loader.js`
2. Search codebase for imports of navbar.js
3. Update all import statements
4. Verify navbar loading works correctly
:::

---

### Rename prompts templates directory to workflows

The `prompts/templates/` directory contains workflow-style prompts like `daily-refactor.md` and `weekly-refactor-maintenance.md`. Renaming to `workflows/` better describes the content purpose.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=1 path=prompts/templates/daily-refactor.md git_url="https://github.com/promptroot/promptroot/blob/main/prompts/templates/daily-refactor.md#L1-L1"}

:::task-stub{title="Rename templates directory to workflows"}
1. Rename `prompts/templates/` to `prompts/workflows/`
2. Search codebase for any hardcoded references to "templates" path
3. Update any configuration or constants referencing this path
4. Verify prompts are still accessible in the UI
:::

---

### Apply jules prefix to subtask-manager module

The modules directory has a clear `jules-*` prefix pattern for Jules-related functionality (jules-api.js, jules-modal.js, jules-queue.js). The `subtask-manager.js` handles Jules subtasks but lacks this prefix.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=50 path=src/modules/subtask-manager.js git_url="https://github.com/promptroot/promptroot/blob/main/src/modules/subtask-manager.js#L1-L50"}

:::task-stub{title="Rename subtask-manager.js to jules-subtask-manager.js"}
1. Rename `src/modules/subtask-manager.js` to `src/modules/jules-subtask-manager.js`
2. Update import in `src/modules/jules-subtask-modal.js` if present
3. Search for any other imports and update
4. Verify subtask functionality works correctly
:::

---

### Standardize session-cache naming to cache-utils

The `session-cache.js` utility provides caching functions but doesn't follow the `-helpers` or `-utils` suffix pattern. Renaming to `cache-utils.js` improves consistency.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=87 path=src/utils/session-cache.js git_url="https://github.com/promptroot/promptroot/blob/main/src/utils/session-cache.js#L1-L87"}

:::task-stub{title="Rename session-cache.js to cache-utils.js"}
1. Rename `src/utils/session-cache.js` to `src/utils/cache-utils.js`
2. Update import in `src/modules/branch-selector.js` line 3
3. Search for any other imports of session-cache.js
4. Update all import statements
5. Verify caching functionality works correctly
:::

---

### Standardize url-params naming to url-utils

The `url-params.js` utility handles URL parameter operations. Shortening to `url-utils.js` aligns with the emerging `-utils` suffix pattern and is more concise.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=51 path=src/utils/url-params.js git_url="https://github.com/promptroot/promptroot/blob/main/src/utils/url-params.js#L1-L51"}

:::task-stub{title="Rename url-params.js to url-utils.js"}
1. Rename `src/utils/url-params.js` to `src/utils/url-utils.js`
2. Search codebase for imports of url-params.js
3. Update all import statements
4. Verify URL parameter parsing works correctly
:::

---

### Rename content.css to content-area.css for clarity

The `content.css` file name is generic. Renaming to `content-area.css` better describes that it styles the main content area component.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=50 path=src/styles/components/content.css git_url="https://github.com/promptroot/promptroot/blob/main/src/styles/components/content.css#L1-L50"}

:::task-stub{title="Rename content.css to content-area.css"}
1. Rename `src/styles/components/content.css` to `src/styles/components/content-area.css`
2. Update @import in `src/styles.css` if present
3. Verify content area styling renders correctly
:::

---

### Convert status-bar default export to named export

The `status-bar.js` module uses a default export pattern while all other modules use named exports. Converting to named export improves consistency across the codebase.

:codex-file-citation[codex-file-citation]{line_range_start=94 line_range_end=96 path=src/modules/status-bar.js git_url="https://github.com/promptroot/promptroot/blob/main/src/modules/status-bar.js#L94-L96"}

:::task-stub{title="Convert status-bar.js to named export"}
1. Change line 95 from `export default statusBar` to `export { statusBar }`
2. Update import in `src/app.js` from default import to named import
3. Search for any other imports of status-bar.js
4. Update all imports to use named import syntax
5. Verify status bar functionality works correctly
:::

---

### Rename promptsync meta.md for naming consistency

The `prompts/promptsync/` directory contains `meta.md` and `promptsync-repo-explorer.md`. Renaming `meta.md` to `promptsync-meta.md` creates consistent file naming within the directory.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=1 path=prompts/promptsync/meta.md git_url="https://github.com/promptroot/promptroot/blob/main/prompts/promptsync/meta.md#L1-L1"}

:::task-stub{title="Rename meta.md to promptsync-meta.md"}
1. Rename `prompts/promptsync/meta.md` to `prompts/promptsync/promptsync-meta.md`
2. Search codebase for any hardcoded references to "meta.md"
3. Update any configuration referencing this file
4. Verify the prompt is still accessible in the UI
:::

---

## Parallel Execution Groups

To minimize merge conflicts, execute tasks in these parallel groups:

**Group A (Browser Extension - Isolated):**
- Rename github-auth.js to auth-handler.js
- Rename github-sync.js to sync-handler.js

**Group B (CSS Files - Isolated):**
- Rename jules-profile.css to jules-profile-modal.css
- Rename home.css to index.css
- Rename content.css to content-area.css

**Group C (Prompts Directory - Isolated):**
- Rename templates directory to workflows
- Rename meta.md to promptsync-meta.md

**Group D (Utils - Sequential due to shared importers):**
- Rename slug.js to slug-utils.js
- Rename title.js to title-utils.js
- Rename session-cache.js to cache-utils.js
- Rename url-params.js to url-utils.js

**Group E (Modules - Sequential due to shared importers):**
- Rename header.js to header-loader.js
- Rename navbar.js to navbar-loader.js
- Rename subtask-manager.js to jules-subtask-manager.js
- Convert status-bar.js to named export

---

*Generated: 2026-01-08*
