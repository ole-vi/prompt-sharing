# Lazy Loading Optimization Plan

## Goal
Minimize initial page load by deferring all non-critical module imports until they're actually needed. Keep authentication and cached UI elements working immediately while lazy loading everything else.

## Current State Analysis

### Home Page (index.html)
**Currently loads on init:**
- Firebase SDK (auth, firestore, functions)
- marked.js (~50KB) - for markdown rendering
- fuse.js (~25KB) - for search
- All page modules (auth, prompt-list, prompt-renderer, etc.)
- Jules API, keys, modal systems

**What should load immediately:**
- ✅ Firebase Auth (needed for login state)
- ✅ Cached repo/branch selectors (show last used repo)
- ✅ Prompt list structure (skeleton/cached data)
- ✅ Basic UI components (header, sidebar)

**What can be lazy loaded:**
- 🔄 marked.js - only when first prompt is rendered
- 🔄 fuse.js - only when search input is used
- 🔄 Jules API modules - only when "Try in Jules" is clicked
- 🔄 Jules modal system - only when opening Jules features
- 🔄 Jules keys/encryption - only when managing API keys
- 🔄 Confirm modal - only when delete/confirm actions triggered

### Jules Page (pages/jules/jules.html)
**Currently loads on init:**
- All Jules modules (API, keys, free-input, account)
- Firebase Functions
- Modal systems

**What should load immediately:**
- ✅ Firebase Auth (check if signed in)
- ✅ Basic page structure

**What can be lazy loaded:**
- 🔄 Jules API key checker - defer until after initial render
- 🔄 Jules free input form - load when "Add to Queue" section expanded
- 🔄 Jules account management - load when account section opened
- 🔄 Repo/branch selectors - load when free input form opened

### Queue Page (pages/queue/queue.html)
**Currently loads on init:**
- Jules queue module
- Subtask modal
- All queue functionality

**What should load immediately:**
- ✅ Firebase Auth
- ✅ Empty queue UI structure

**What can be lazy loaded:**
- 🔄 Queue list rendering - load after auth check
- 🔄 Subtask error modal - load only when error occurs
- 🔄 Schedule modal - load only when schedule button clicked

### Sessions Page (pages/sessions/sessions.html)
**Currently loads on init:**
- Jules API (listSessions)
- fuse.js for search
- Prompt viewer

**What should load immediately:**
- ✅ Firebase Auth
- ✅ Basic page structure

**What can be lazy loaded:**
- 🔄 Jules API - load after auth confirmed
- 🔄 fuse.js - load only when search input used
- 🔄 Prompt viewer - load only when "view prompt" clicked

### Profile Page (pages/profile/profile.html)
**Currently loads on init:**
- Jules keys management
- Confirm modal

**What should load immediately:**
- ✅ Firebase Auth
- ✅ Profile display

**What can be lazy loaded:**
- 🔄 Jules keys management - load when "Manage Keys" section opened
- 🔄 Confirm modal - load only when delete action triggered

## Implementation Strategy

### Phase 1: External Libraries (High Impact)
**Impact: ~75KB reduction on initial load**

1. ✅ **marked.js** (~50KB)
   - Remove from all HTML `<script>` tags
   - Create `src/utils/lazy-loaders.js` with `loadMarked()` function
   - Update `prompt-renderer.js` to lazy load before first parse

2. ✅ **fuse.js** (~25KB)
   - Remove from HTML `<script>` tags (index.html, sessions.html)
   - Add `loadFuse()` to lazy-loaders.js
   - Update `prompt-list.js` to load only when search input has value
   - Update `sessions-page.js` to load only when search input has value

3. 🔄 **Firebase Functions** (~30KB)
   - Remove from HTML where not immediately needed
   - Load dynamically in `jules-api.js` when first API call made

### Phase 2: Home Page Critical Path Optimization
**Impact: Faster time-to-interactive**

1. ✅ **Dynamic imports for jules-api.js**
   - Change `app.js` to wrap `handleTryInJules` in dynamic import
   - Only loads when user clicks "Try in Jules" button
   - Saves ~10KB + dependencies on initial load

2. ✅ **Dynamic imports for jules-modal.js**
   - Load only when Jules features opened
   - Includes repo selector, branch selector dependencies
   - Saves ~15KB on initial load

3. ✅ **Dynamic imports for jules-keys.js**
   - Load only in Jules management contexts
   - Includes encryption utilities
   - Saves ~8KB on initial load

4. 🔄 **Lazy load confirm-modal.js**
   - Only load when delete/confirm actions triggered
   - Used across multiple pages

### Phase 3: Jules Page Optimization
**Impact: Faster Jules page loads**

1. ✅ **Defer Jules key check**
   - Check auth first, render basic UI
   - Then dynamically import and check API key
   - Better perceived performance

2. ✅ **Lazy load free input form**
   - Show collapsed by default
   - Load `jules-free-input.js` when expanded
   - Defers repo-branch-selector loading

3. 🔄 **Lazy load account management**
   - Separate module for account display/management
   - Load only when account section accessed

### Phase 4: Other Pages Optimization

1. ✅ **Queue Page**
   - Remove eager modal loading
   - Load subtask modal only on errors
   - Load schedule modal only when button clicked

2. ✅ **Sessions Page**
   - Defer Jules API import until after auth
   - Lazy load fuse.js for search
   - Lazy load prompt viewer for modals

3. ✅ **Profile Page**
   - Lazy load Jules keys management
   - Lazy load confirm modal

### Phase 5: Advanced Optimizations

1. 🔄 **Code splitting by feature**
   - Group related Jules features together
   - Create feature bundles that load together
   
2. 🔄 **Prefetching hints**
   - Add `<link rel="prefetch">` for likely-needed modules
   - Example: prefetch Jules API when hovering "Try in Jules"

3. 🔄 **Service Worker caching**
   - Cache lazy-loaded modules after first load
   - Instant subsequent loads

## Implementation Guidelines

### Pattern: Lazy Loading External Library
```javascript
// src/utils/lazy-loaders.js
const loadedLibraries = new Map();

export async function loadMarked() {
  if (loadedLibraries.has('marked')) {
    return window.marked;
  }
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    script.onload = () => {
      loadedLibraries.set('marked', true);
      resolve(window.marked);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
```

### Pattern: Dynamic Import with Loading State
```javascript
async function handleAction(event) {
  const button = event.target.closest('button');
  const originalText = button.textContent;
  
  try {
    button.disabled = true;
    button.textContent = 'Loading...';
    
    const { moduleFunction } = await import('./modules/feature.js');
    await moduleFunction();
    
  } catch (error) {
    console.error('Failed to load module:', error);
    showToast('Failed to load feature', 'error');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}
```

### Pattern: Conditional Lazy Loading
```javascript
// Only load if not already loaded
let promptRendererModule = null;

async function renderPrompt(content) {
  if (!promptRendererModule) {
    promptRendererModule = await import('./modules/prompt-renderer.js');
  }
  return promptRendererModule.render(content);
}
```

### Pattern: Cache-then-Load
```javascript
// Show cached data immediately, lazy load refresh functionality
async function initList() {
  const cached = sessionStorage.getItem('listCache');
  if (cached) {
    renderList(JSON.parse(cached)); // Show immediately
  }
  
  // Load API module in background
  const { refreshList } = await import('./modules/api.js');
  const fresh = await refreshList();
  renderList(fresh);
}
```

## Testing Checklist

### Home Page
- [ ] Page loads without errors
- [ ] Cached repo/branch selector shows immediately
- [ ] Login/logout works correctly
- [ ] Prompt list renders with cached data
- [ ] Search loads fuse.js and works
- [ ] "Try in Jules" button loads Jules modules
- [ ] marked.js loads when viewing first prompt

### Jules Page
- [ ] Page loads for signed-in users
- [ ] API key check deferred but works
- [ ] Free input form expands and loads modules
- [ ] Queue submission works
- [ ] Account section loads correctly

### Queue Page
- [ ] Queue list loads after auth
- [ ] Modals load only when triggered
- [ ] No errors on page load

### Sessions Page
- [ ] Sessions list loads after auth
- [ ] Search loads fuse.js dynamically
- [ ] Prompt viewer loads when needed

### Profile Page
- [ ] Profile displays immediately
- [ ] Keys management loads when opened
- [ ] Delete actions load confirm modal

## Performance Targets

### Initial Load (Home Page)
- **Before optimization:** ~350KB JavaScript
- **After Phase 1:** ~275KB (-75KB from external libs)
- **After Phase 2:** ~240KB (-35KB from Jules modules)
- **Target:** <250KB initial bundle

### Time to Interactive
- **Before:** ~2.5s on 3G
- **Target:** <1.5s on 3G

### Subsequent Page Loads
- **Target:** Instant (cached modules)

## Rollout Plan

1. ✅ **Week 1:** Phase 1 (External libraries) - High impact, low risk
2. ✅ **Week 1:** Phase 2 (Home page) - Medium impact, medium risk
3. ✅ **Week 1:** Phase 3 & 4 (Other pages) - Low impact, low risk
4. 🔄 **Week 2:** Phase 5 (Advanced) - Variable impact, testing required
5. 🔄 **Week 2:** Performance monitoring and optimization

## Success Metrics

- [ ] Initial bundle size < 250KB
- [ ] Time to interactive < 1.5s on 3G
- [ ] No increase in error rates
- [ ] All features still work correctly
- [ ] Lighthouse performance score > 90

## Rollback Plan

If critical issues discovered:
1. Git revert specific commits
2. Deploy previous version
3. Add regression tests for issue
4. Fix and re-deploy

## Notes

- Always add error handling to dynamic imports
- Show loading states during module loading
- Test on slow connections
- Monitor error logs for failed imports
- Consider prefetching for common user flows
