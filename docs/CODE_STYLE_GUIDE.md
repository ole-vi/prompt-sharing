# PromptSync Code Style Guide

**Version:** 1.0  
**Last Updated:** January 6, 2026

This guide covers JavaScript patterns, module architecture, and coding conventions for the PromptSync application. For UI/CSS guidelines, see [UI_GUIDELINES.md](UI_GUIDELINES.md).

---

## Module Architecture

### File Organization

```
src/
├── modules/           # Feature modules
│   ├── auth.js
│   ├── branch-selector.js
│   ├── github-api.js
│   ├── header.js
│   ├── jules-api.js
│   ├── jules.js
│   ├── navbar.js
│   ├── page-init.js
│   ├── prompt-list.js
│   ├── prompt-renderer.js
│   ├── repo-branch-selector.js
│   ├── status-bar.js
│   └── subtask-manager.js
└── utils/            # Shared utilities
    ├── constants.js
    ├── dom-helpers.js
    ├── session-cache.js
    ├── slug.js
    ├── title.js
    └── url-params.js
```

### Module Pattern

Use ES6 modules with named exports:

```javascript
// ✅ Good: Named exports
export function initComponent() { }
export function updateState() { }

// ❌ Avoid: Default exports
export default function() { }
```

### Module Responsibilities

- **Modules**: Feature-specific logic (auth, navigation, API integration)
- **Utils**: Pure functions, shared helpers, no side effects
- **Keep modules focused**: One primary responsibility per module

---

## DOM Manipulation

### DOM Helpers

Located in `src/utils/dom-helpers.js`:

```javascript
import { 
  createElement, 
  setElementDisplay, 
  toggleClass, 
  clearElement, 
  onElement,
  stopPropagation 
} from '../utils/dom-helpers.js';
```

#### Available Functions

**createElement(tag, className, textContent)**
```javascript
const div = createElement('div', 'my-class', 'Text content');
const button = createElement('button', 'btn primary');
```

**setElementDisplay(element, show)**
```javascript
setElementDisplay(element, true);  // Show
setElementDisplay(element, false); // Hide
```

**toggleClass(element, className, force)**
```javascript
toggleClass(element, 'active');           // Toggle
toggleClass(element, 'open', true);       // Force add
toggleClass(element, 'hidden', false);    // Force remove
```

**clearElement(element)**
```javascript
clearElement(listElement); // Removes all child nodes
```

**onElement(element, event, handler)**
```javascript
onElement(button, 'click', handleClick);
```

**stopPropagation(event)**
```javascript
onElement(badge, 'click', (e) => {
  stopPropagation(e);
  // Handle badge click
});
```

---

## Visibility Management

### Preferred: Use `.hidden` Class

```javascript
// ✅ Good: Class-based visibility
element.classList.add('hidden');      // Hide
element.classList.remove('hidden');   // Show
element.classList.toggle('hidden');   // Toggle
```

### Use Helper When Appropriate

```javascript
// ✅ Good: Helper function
import { setElementDisplay } from '../utils/dom-helpers.js';
setElementDisplay(element, isVisible);
```

### Avoid Direct Style Manipulation

```javascript
// ❌ Avoid: Direct style manipulation
element.style.display = 'none';
element.style.display = 'block';
```

**Exception**: Use direct manipulation only when dynamic values are required (e.g., positioning, animations).

---

## State Management

### Use State Classes

```javascript
// Modals
modal.classList.add('show');
modal.classList.remove('show');

// Dropdowns
dropdown.classList.add('open');
dropdown.classList.remove('open');

// Tree items
treeItem.classList.add('submenu-open');
treeItem.classList.remove('submenu-open');

// Active items
listItem.classList.add('active');
siblingItem.classList.remove('active');
```

### Avoid Data Attributes for State

```javascript
// ❌ Avoid: data-* for frequently-changed state
element.dataset.open = 'true';

// ✅ Good: CSS classes for state
element.classList.add('open');
```

**Use data-* for**: Static metadata, component configuration, identifiers

---

## Event Handling

### Event Delegation

Prefer delegated event listeners for dynamic content:

```javascript
// ✅ Good: Event delegation
listEl.addEventListener('click', (event) => {
  const badge = event.target.closest('.tag-badge');
  if (badge) {
    event.preventDefault();
    event.stopPropagation();
    handleBadgeClick(badge);
  }
});
```

```javascript
// ❌ Avoid: Individual listeners on dynamic elements
items.forEach(item => {
  item.addEventListener('click', handleClick);
});
```

### Event Cleanup

Remove event listeners when components are destroyed:

```javascript
function destroy() {
  element.removeEventListener('click', handleClick);
  window.removeEventListener('resize', handleResize);
}
```

### Outside Click Detection

```javascript
function setupOutsideClick(element, callback) {
  document.addEventListener('click', (e) => {
    if (!element.contains(e.target)) {
      callback();
    }
  });
}
```

---

## Async Patterns

### Use async/await

```javascript
// ✅ Good: async/await
async function loadData() {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to load data:', error);
    showStatus('Failed to load data', 'error');
  }
}
```

### Error Handling

Always handle errors in async functions:

```javascript
// ✅ Good: Error handling
async function submitForm() {
  try {
    const result = await api.submit(data);
    showStatus('Submitted successfully', 'success');
    return result;
  } catch (error) {
    console.error('Submission failed:', error);
    showStatus('Submission failed', 'error');
    throw error; // Re-throw if caller needs to handle
  }
}
```

---

## Component Initialization

### Consistent Init Pattern

```javascript
export function initComponent() {
  // 1. Get DOM elements
  const container = document.getElementById('container');
  const button = document.getElementById('submitBtn');
  
  if (!container) {
    console.warn('Container not found, skipping init');
    return;
  }
  
  // 2. Set initial state
  loadInitialData();
  
  // 3. Attach event listeners
  button?.addEventListener('click', handleSubmit);
  
  // 4. Additional setup
  setupKeyboardHandlers();
}
```

### Null Safety

Check for element existence before attaching listeners:

```javascript
// ✅ Good: Null checks
const button = document.getElementById('myBtn');
if (button) {
  button.addEventListener('click', handleClick);
}

// Or use optional chaining
button?.addEventListener('click', handleClick);
```

---

## Modal Management

### Opening Modals

```javascript
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  modal.classList.add('show');
  trapFocus(modal);
  
  // Store reference to previously focused element
  modal.dataset.previousFocus = document.activeElement;
  
  // Focus first input
  const firstInput = modal.querySelector('input, textarea, button');
  firstInput?.focus();
}
```

### Closing Modals

```javascript
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  modal.classList.remove('show');
  
  // Restore focus
  const previousFocus = document.querySelector(modal.dataset.previousFocus);
  previousFocus?.focus();
  
  // Clear form inputs if needed
  const form = modal.querySelector('form');
  form?.reset();
}
```

### Keyboard Handlers

```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const openModal = document.querySelector('.modal.show');
    if (openModal) {
      closeModal(openModal.id);
    }
  }
});
```

---

## Dropdown Management

### Toggle Dropdown

```javascript
function toggleDropdown(dropdownId) {
  const dropdown = document.getElementById(dropdownId);
  const menu = dropdown.querySelector('.custom-dropdown-menu');
  const button = dropdown.querySelector('.custom-dropdown-btn');
  
  const isOpen = menu.style.display === 'block';
  
  // Close all other dropdowns
  document.querySelectorAll('.custom-dropdown-menu').forEach(m => {
    m.style.display = 'none';
  });
  
  // Toggle this dropdown
  if (!isOpen) {
    menu.style.display = 'block';
    button.setAttribute('aria-expanded', 'true');
  } else {
    menu.style.display = 'none';
    button.setAttribute('aria-expanded', 'false');
  }
}
```

### Close on Outside Click

```javascript
document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-dropdown')) {
    document.querySelectorAll('.custom-dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  }
});
```

---

## Status Messages

### Show Status

```javascript
import { showStatus } from './modules/status-bar.js';

// Success message
showStatus('Changes saved successfully', 'success');

// Error message
showStatus('Failed to save changes', 'error');

// Progress message
showStatus('Processing...', 'progress');

// Info message
showStatus('No changes detected', 'info');
```

### Replace Native Dialogs

```javascript
// ❌ Avoid: Blocking native dialogs
alert('Success!');
const confirmed = confirm('Are you sure?');
const input = prompt('Enter value:');

// ✅ Good: Non-blocking UI
showStatus('Success!', 'success');
openConfirmModal('Are you sure?', handleConfirm);
openInputModal('Enter value:', handleInput);
```

---

## API Integration

### GitHub API Pattern

```javascript
// src/modules/github-api.js
export async function fetchRepos(owner) {
  const url = `https://api.github.com/users/${owner}/repos`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch repos:', error);
    throw error;
  }
}
```

### Jules API Pattern

```javascript
// src/modules/jules-api.js
export async function submitTask(task, apiKey) {
  const url = 'https://api.jules.com/v1/tasks';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(task)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Jules API error:', error);
    throw error;
  }
}
```

---

## Local Storage

### Constants

Define storage keys in `src/utils/constants.js`:

```javascript
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'promptsync_auth_token',
  USER_PREFS: 'promptsync_user_prefs',
  JULES_API_KEY: 'promptsync_jules_key',
  LAST_REPO: 'promptsync_last_repo'
};
```

### Usage

```javascript
import { STORAGE_KEYS } from '../utils/constants.js';

// Save
localStorage.setItem(STORAGE_KEYS.USER_PREFS, JSON.stringify(prefs));

// Load
const prefs = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_PREFS) || '{}');

// Remove
localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
```

---

## Naming Conventions

### Variables

```javascript
// camelCase for variables and functions
const userName = 'John';
const isActive = true;
function getUserData() { }

// UPPER_SNAKE_CASE for constants
const MAX_RETRIES = 3;
const API_BASE_URL = 'https://api.example.com';

// Prefix booleans with is/has/should
const isLoading = false;
const hasError = true;
const shouldRetry = false;
```

### Functions

```javascript
// Verbs for actions
function loadData() { }
function saveChanges() { }
function deleteItem() { }

// handle* for event handlers
function handleClick(event) { }
function handleSubmit(event) { }

// on* for callbacks
function onDataLoaded(data) { }
function onError(error) { }

// init* for initialization
function initComponent() { }
function initEventListeners() { }
```

### Element Selectors

```javascript
// Suffix with El for DOM elements
const containerEl = document.getElementById('container');
const buttonEl = document.querySelector('.btn');
const inputEls = document.querySelectorAll('input');
```

---

## Comments

### JSDoc for Public Functions

```javascript
/**
 * Loads prompt data from GitHub repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path within repository
 * @returns {Promise<Object>} Prompt data
 */
export async function loadPrompt(owner, repo, path) {
  // Implementation
}
```

### Inline Comments

```javascript
// ✅ Good: Explain "why", not "what"
// Cache DOM queries to avoid repeated lookups
const elements = new Map();

// ❌ Avoid: Obvious comments
// Set the display to none
element.style.display = 'none';
```

---

## Anti-Patterns

### ❌ Global Variables

```javascript
// Bad: Pollutes global scope
window.currentUser = user;

// Good: Module-scoped
let currentUser = null;
export function setCurrentUser(user) {
  currentUser = user;
}
```

### ❌ Inline Event Handlers

```html
<!-- Bad: Inline handlers -->
<button onclick="handleClick()">Click</button>

<!-- Good: JavaScript event listeners -->
<button id="myButton">Click</button>
```

```javascript
document.getElementById('myButton').addEventListener('click', handleClick);
```

### ❌ Hard-coded IDs

```javascript
// Bad: Hard-coded, not reusable
function openModal() {
  document.getElementById('myModal').classList.add('show');
}

// Good: Parameterized
function openModal(modalId) {
  document.getElementById(modalId)?.classList.add('show');
}
```

### ❌ Synchronous Operations

```javascript
// Bad: Blocks main thread
const data = fetchDataSync();

// Good: Async
const data = await fetchData();
```

---

## Testing Considerations

### Testable Functions

```javascript
// ✅ Good: Pure, testable
export function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ Avoid: Side effects make testing harder
function calculateTotal(items) {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  document.getElementById('total').textContent = total;
  return total;
}
```

### Separate DOM from Logic

```javascript
// Logic (testable)
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// DOM interaction (separate)
function checkEmailInput() {
  const email = inputEl.value;
  const isValid = validateEmail(email);
  toggleClass(inputEl, 'error', !isValid);
}
```

---

## Performance

### Debounce User Input

```javascript
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Usage
searchInput.addEventListener('input', debounce((e) => {
  performSearch(e.target.value);
}, 300));
```

### Cache DOM Queries

```javascript
// ❌ Avoid: Repeated queries
function updateUI() {
  document.getElementById('title').textContent = title;
  document.getElementById('title').style.color = 'red';
  document.getElementById('title').classList.add('active');
}

// ✅ Good: Cache the query
function updateUI() {
  const titleEl = document.getElementById('title');
  titleEl.textContent = title;
  titleEl.style.color = 'red';
  titleEl.classList.add('active');
}
```

### Batch DOM Updates

```javascript
// ❌ Avoid: Multiple reflows
items.forEach(item => {
  list.appendChild(createListItem(item));
});

// ✅ Good: Document fragment
const fragment = document.createDocumentFragment();
items.forEach(item => {
  fragment.appendChild(createListItem(item));
});
list.appendChild(fragment);
```

---

## File Reference

### Key Modules

| Module | Purpose |
|--------|---------|
| `auth.js` | Firebase authentication |
| `github-api.js` | GitHub API integration |
| `jules-api.js` | Jules AI API integration |
| `prompt-list.js` | Sidebar tree navigation |
| `status-bar.js` | Status notifications |
| `header.js` | Shared header component |
| `navbar.js` | Bottom navigation |

### Key Utilities

| Utility | Purpose |
|---------|---------|
| `dom-helpers.js` | DOM manipulation helpers |
| `constants.js` | Shared constants and configs |
| `slug.js` | String slugification |
| `url-params.js` | URL parameter handling |
| `session-cache.js` | Session caching |

---

## Version History

- **v1.0** (Jan 6, 2026): Initial code style guide

---

**Questions?** Check existing implementations in `src/modules/` for reference patterns. For UI/CSS guidelines, see [UI_GUIDELINES.md](UI_GUIDELINES.md).
