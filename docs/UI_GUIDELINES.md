# PromptSync UI Guidelines

**Version:** 2.0  
**Last Updated:** January 6, 2026

These conventions ensure UI changes remain consistent, maintainable, and accessible across all pages and features. Follow them for new features and when refactoring existing code.

---

## Design Principles

1. **Consistency first**: Use shared utilities, components, and patterns.
2. **Semantic HTML**: Proper headings (`<h1>`, `<h2>`), lists (`<ul>`, `<ol>`), buttons (`<button>`), and inputs with appropriate elements.
3. **No inline styles**: Prefer utility classes and component styles. Avoid `style=""` attributes.
4. **Responsive by default**: Layouts should flex/stack cleanly across breakpoints (1000px, 600px, 400px).
5. **Dark theme optimized**: Use CSS custom properties (`:root` variables) for colors.

---

## CSS Architecture

### File Structure

```
src/styles/
├── base.css           # Variables, reset, global utilities
├── layout.css         # Grid, responsive breakpoints
├── components/        # Reusable UI components
│   ├── buttons.css
│   ├── card.css
│   ├── content.css
│   ├── dropdown.css
│   ├── header.css
│   ├── modals.css
│   ├── navbar.css
│   ├── pills.css
│   ├── sidebar.css
│   ├── status-bar.css
│   ├── list.css
│   ├── tree.css
│   └── tags.css
└── pages/             # Page-specific styles
    ├── home.css
    ├── jules.css
    ├── queue.css
    ├── sessions.css
    ├── profile.css
    └── webcapture.css
```

### CSS Variables (Design Tokens)

Located in `base.css`:

```css
:root {
  /* Core Colors */
  --bg: #0a0e1a;
  --card: #141829;
  --muted: #8b94a8;
  --text: #f0f3f8;
  --accent: #4dd9ff;
  --accent-glow: #4dd9ff1a;
  --border: #222438;
  
  /* Gradients */
  --gradient-primary: linear-gradient(135deg, #4dd9ff 0%, #5ad1ff 100%);
  --gradient-bg: linear-gradient(180deg, #0d1424 0%, #0a0e1a 100%);
  
  /* Semantic Colors */
  --danger: #c0504d;
  --warn: #f39c12;
  --info: #2980b9;
  --success: #27ae60;
  --error: #ff6b6b;
}
```

**Usage**: Always reference variables (`var(--accent)`) rather than hardcoding colors.

---

## Naming Conventions

- **Hyphen-case**: `.section-heading`, `.user-menu`, `.modal-content`
- **BEM-inspired for components**: `.modal`, `.modal__content`, `.modal__overlay`
- **Modifier variants with double dash**: `.btn--sm`, `.btn--primary`, `.custom-dropdown--compact`
- **State classes**: `.hidden`, `.show`, `.open`, `.active`, `.collapsed`
- **Utility classes**: Short, composable helpers (`.mb-md`, `.flex`, `.gap-sm`)

---

## Utility Classes

### Layout Utilities

```css
.flex          /* display: flex */
.grid          /* display: grid */
.hidden        /* display: none !important */
.w-full        /* width: 100% */
```

### Spacing Utilities

```css
.gap-sm        /* gap: 8px */
.gap-md        /* gap: 16px */
.mb-sm         /* margin-bottom: 8px */
.mb-md         /* margin-bottom: 16px */
.mt-sm         /* margin-top: 8px */
.mt-md         /* margin-top: 16px */
.ml-auto       /* margin-left: auto */
.pad-lg        /* padding: 24px */
.pad-xl        /* padding: 48px */
```

### Typography Utilities

```css
.text-center   /* text-align: center */
.muted         /* color: var(--muted) */
.font-16       /* font-size: 16px */
.fw-600        /* font-weight: 600 */
.small-text    /* font-size: 13px */
```

### Overflow Utilities

```css
.y-scroll      /* overflow-y: auto */
.max-h-300     /* max-height: 300px */
```

---

## Component Patterns

### Buttons

**Classes**: `.btn`, `.btn.primary`, `.btn.danger`, `.btn.warn`, `.btn.info`, `.btn.success`  
**Size variants**: `.btn.sm`, `.btn.lg`, `.btn.xl`

```html
<button class="btn">Default</button>
<button class="btn primary">Primary</button>
<button class="btn danger">Delete</button>
<button class="btn sm">Compact</button>
<button class="btn xl primary">Large Primary</button>
```

**Guidelines**:
- Use semantic variants for intent (`.primary` for primary actions, `.danger` for destructive)
- Use `.btn.sm` for header/toolbar actions to keep UI compact
- Avoid inline styles; use defined size/variant classes

### Cards

**Class**: `.card`

```html
<div class="card pad-lg">
  <!-- Card content -->
</div>
```

**Guidelines**:
- Use `.card` for main content containers (sidebar, main area)
- Combine with padding utilities (`.pad-lg`, `.pad-xl`)
- Cards have gradient background, border, rounded corners, and backdrop blur

### Modals

**Structure**:
```html
<div id="exampleModal" class="modal">
  <div class="modal-content">
    <h2>Modal Title</h2>
    <p>Description text</p>
    <!-- Form inputs, content -->
    <div class="modal-buttons">
      <button class="btn">Cancel</button>
      <button class="btn primary">Confirm</button>
    </div>
  </div>
</div>
```

**Size variants**: `.modal-content.modal-sm`, `.modal-content.modal-lg`, `.modal-content.modal-xl`

**Show/hide**: Toggle `.show` class on `.modal`

```javascript
modal.classList.add('show');    // Open
modal.classList.remove('show'); // Close
```

**Accessibility requirements**:
- Add `role="dialog"` and `aria-modal="true"`
- Label with `aria-labelledby` pointing to heading ID
- Trap focus within modal when open
- Close on `Esc` key and overlay click
- Restore focus to trigger element on close

**Inputs**: Use `.modal-input` for text inputs, `.modal-textarea` for textareas, `.modal select` for dropdowns

### Dropdowns

**Structure**:
```html
<div class="custom-dropdown">
  <button class="custom-dropdown-btn" type="button">
    <span>Selected Item</span>
    <span class="custom-dropdown-caret">▼</span>
  </button>
  <div class="custom-dropdown-menu" role="menu">
    <div class="custom-dropdown-item">Item 1</div>
    <div class="custom-dropdown-item selected">Item 2</div>
    <div class="custom-dropdown-item">Item 3</div>
  </div>
</div>
```

**Variants**:
- `.custom-dropdown--compact`: Narrow trigger width
- `.custom-dropdown--wide-menu`: Wide menu anchored to right

**Show/hide**: Toggle menu `display` via JavaScript or manage with state class

**Accessibility requirements**:
- Add `aria-haspopup="true"` and `aria-expanded="false/true"` to button
- Support Arrow keys for navigation, Enter/Space to select, Esc to close
- Close on outside click
- Add `role="menu"` to menu and `role="menuitem"` to items

### Pills/Badges

**Class**: `.pill`

```html
<span class="pill">Active</span>
```

**Guidelines**:
- Use for status indicators, tags, and labels
- Inline-flex with icon support

### Lists & Items

**Class**: `.item`

```html
<div class="item">
  <div>
    <div class="item-title">Item Title</div>
    <div class="item-meta">Metadata</div>
  </div>
  <!-- Actions -->
</div>
```

**Active state**: Add `.active` class for selected items

### Status Bar

**ID**: `#statusBar`  
**Show/hide**: Toggle `.status-visible` class

```javascript
statusBar.classList.add('status-visible');
statusBar.querySelector('.status-msg').textContent = 'Processing...';
```

**Guidelines**:
- Use for long-running operations
- Position: fixed at bottom
- Replace native `alert()`, `confirm()`, `prompt()` with non-blocking UI

### Tree Navigation

**Structure**: Used in sidebar for hierarchical file lists

```html
<div class="tree-dir">
  <button aria-expanded="false">▶</button>
  <span class="folder-name">Folder Name</span>
  <div class="folder-icons">
    <span class="add-file-icon">+</span>
  </div>
</div>
```

**State class**: `.submenu-open` when expanded

---

## Layout Patterns

### Page Structure

```html
<body data-page="home">
  <div class="wrap">
    <aside id="sidebar" class="card">
      <!-- Sidebar content -->
    </aside>
    <main id="main" class="card pad-lg">
      <!-- Main content -->
    </main>
  </div>
</body>
```

**Guidelines**:
- Use `.wrap` container for grid layout (sidebar + main)
- Add `data-page` attribute to `<body>` for page identification
- Sidebar collapses responsively on mobile (< 1000px)

### Section Headings

**Class**: `.section-heading`

```html
<h2 class="section-heading">Section Title</h2>
```

**Guidelines**:
- Consistent margin and sizing
- Use for major page sections

**Variants**:
- `.section-title`: Alternative section heading style
- `.section-title-lg`: Larger page-level heading (24px, bold)

### Page Headers with Actions

```html
<div class="page-header">
  <h2 class="section-title-lg">Page Title</h2>
  <div class="toolbar-actions">
    <button class="btn sm">Action 1</button>
    <button class="btn sm primary">Action 2</button>
  </div>
</div>
```

### Toolbars

**Class**: `.toolbar`

```html
<div class="toolbar">
  <div>Left content</div>
  <div class="toolbar-actions">
    <button class="btn sm">Filter</button>
    <button class="btn sm">Sort</button>
  </div>
</div>
```

### Forms

**Structure**:
```html
<div class="form-row">
  <div class="form-col">
    <label class="form-label">Label:</label>
    <input type="text" class="modal-input" />
  </div>
  <div class="form-col">
    <label class="form-label">Label:</label>
    <input type="text" class="modal-input" />
  </div>
</div>
```

**Form controls**:
- `.modal-input`: Text inputs
- `.modal-textarea`: Textareas
- `.text-input`: Larger textarea variant
- `.form-label`: Form labels

---

## Responsive Breakpoints

Defined in `layout.css`:

| Breakpoint | Max Width | Behavior |
|------------|-----------|----------|
| Desktop | > 1000px | Two-column grid (sidebar + main) |
| Tablet/Mobile | ≤ 1000px | Single column, mobile menu |
| Mobile | ≤ 600px | Adjusted spacing, status bar |
| Small Mobile | ≤ 400px | Compact navbar, smaller fonts |

**Mobile-specific**:
- `#mobileMenuBtn` shows hamburger menu
- `#mobileSidebar` slides in from left
- `#mobileOverlay` adds backdrop
- Desktop sidebar hidden, replaced by mobile navigation

---

## JavaScript Patterns

### Module Structure

- **Location**: `src/modules/`
- **Utilities**: `src/utils/`
- **Pattern**: ES6 modules with named exports

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

// Toggle visibility
setElementDisplay(element, true);  // Show
setElementDisplay(element, false); // Hide

// Toggle classes
toggleClass(element, 'active');
toggleClass(element, 'open', true); // Force add

// Clear element content
clearElement(listElement);

// Create element
const div = createElement('div', 'my-class', 'Text content');
```

### Visibility Management

**Preferred**: Use `.hidden` class and `toggleClass()`

```javascript
element.classList.add('hidden');    // Hide
element.classList.remove('hidden'); // Show
element.classList.toggle('hidden'); // Toggle
```

**Avoid**: Direct `style.display` manipulation unless absolutely necessary

### State Classes

Use state classes for interactive components:

```javascript
// Modals
modal.classList.add('show');
modal.classList.remove('show');

// Dropdowns
dropdown.classList.add('open');

// Tree items
treeItem.classList.add('submenu-open');

// Active items
listItem.classList.add('active');
```

### Event Delegation

Prefer delegated event listeners for dynamic content:

```javascript
listEl.addEventListener('click', (event) => {
  const badge = event.target.closest('.tag-badge');
  if (badge) {
    event.preventDefault();
    event.stopPropagation();
    // Handle badge click
  }
});
```

---

## Accessibility Guidelines

### Keyboard Support

| Component | Keys | Behavior |
|-----------|------|----------|
| Modals | `Esc` | Close modal |
| Dropdowns | `Arrow Up/Down` | Navigate items |
| | `Enter/Space` | Select item |
| | `Esc` | Close dropdown |
| Buttons/Links | `Enter/Space` | Activate |
| Tree navigation | `Arrow Left/Right` | Collapse/expand |

### Focus Management

- **Modals**: Trap focus within modal when open; restore focus to trigger on close
- **Dropdowns**: Move focus to first item when opened
- **Focus indicators**: Ensure visible focus styles (`:focus`)

### ARIA Attributes

- **Modals**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- **Dropdowns**: `aria-haspopup="true"`, `aria-expanded`, `role="menu"`, `role="menuitem"`
- **Buttons**: `aria-label` for icon-only buttons
- **Expandable sections**: `aria-expanded="true/false"`

### Color Contrast

- Meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- Test with color contrast tools
- Use semantic color variables for consistency

### Semantic HTML

- Use proper heading hierarchy (`<h1>` → `<h2>` → `<h3>`)
- Use `<button>` for actions, `<a>` for navigation
- Use `<label>` for form inputs
- Use semantic elements: `<nav>`, `<main>`, `<aside>`, `<header>`, `<footer>`

---

## Anti-Patterns (Avoid)

❌ **Inline styles**
```html
<div style="color: red; padding: 10px;">Bad</div>
```
✅ Use utility classes or component styles

❌ **Direct style manipulation**
```javascript
element.style.display = 'block';
```
✅ Use `.hidden` class and `toggleClass()`

❌ **Generic IDs**
```html
<div id="modal">...</div>
<div id="modal">...</div> <!-- Conflict! -->
```
✅ Use specific IDs or classes

❌ **Hard-coded colors**
```css
.my-element { color: #4dd9ff; }
```
✅ Use CSS variables
```css
.my-element { color: var(--accent); }
```

❌ **Non-semantic HTML**
```html
<div onclick="handleClick()">Click me</div>
```
✅ Use semantic elements
```html
<button onclick="handleClick()">Click me</button>
```

❌ **Native blocking popups**
```javascript
alert('Hello');
confirm('Are you sure?');
```
✅ Use modals and status bar

---

## Review Checklist

Before merging UI changes, verify:

- [ ] Section spacing consistent (`.section-heading`, `.page-header`)
- [ ] Header actions use `.btn.sm` for compactness
- [ ] No inline styles; visibility via `.hidden` and state classes
- [ ] Modals and dropdowns use shared structure
- [ ] Keyboard accessible (Enter/Space/Arrow/Esc support)
- [ ] Focus management implemented for modals/dropdowns
- [ ] ARIA attributes present where appropriate
- [ ] Color contrast meets WCAG AA standards
- [ ] No native blocking popups (alert/confirm/prompt)
- [ ] Responsive across breakpoints (1000px, 600px, 400px)
- [ ] Semantic HTML elements used
- [ ] CSS variables used for colors
- [ ] Works with dark theme

---

## Common Tasks

### Add a new modal

1. Create HTML structure with `.modal` and `.modal-content`
2. Add `.show` class toggle in JavaScript
3. Implement keyboard handlers (Esc to close)
4. Add focus trap and restoration
5. Add ARIA attributes

### Add a new dropdown

1. Use `.custom-dropdown` structure from patterns
2. Implement show/hide logic (toggle menu display)
3. Add outside-click handler to close
4. Implement keyboard navigation (Arrow/Enter/Esc)
5. Add ARIA attributes

### Add a new page

1. Copy structure from existing page (e.g., `jules.html`)
2. Set appropriate `data-page` attribute on `<body>`
3. Include shared header via `header.js`
4. Use `.wrap` layout with `.card` containers
5. Add page-specific styles in `src/styles/pages/`

### Show a status message

```javascript
import { showStatus } from './modules/status-bar.js';
showStatus('Processing...', 'progress');
```

---

## File Reference

### Key Modules

- `src/modules/header.js` - Shared header component
- `src/modules/prompt-list.js` - Sidebar tree navigation
- `src/modules/navbar.js` - Bottom navigation bar
- `src/modules/status-bar.js` - Status notifications
- `src/modules/jules.js` - Jules integration
- `src/modules/auth.js` - Authentication

### Key Utilities

- `src/utils/dom-helpers.js` - DOM manipulation helpers
- `src/utils/constants.js` - Shared constants and configs
- `src/utils/slug.js` - String slugification
- `src/utils/url-params.js` - URL parameter handling

### Shared Components

- `partials/header.html` - Shared header HTML (loaded by `header.js`)

---

## Progressive Enhancement

When adding new features:

1. **Start high-traffic pages**: Home, Jules
2. **Then secondary pages**: Sessions, Queue, Profile, Web Capture
3. **Then modules**: Individual component improvements
4. **Test mobile-first**: Ensure responsive behavior works at all breakpoints

---

## Additional Resources

- **Marked.js**: Used for Markdown rendering
- **Fuse.js**: Used for fuzzy search
- **Firebase**: Authentication, Firestore, Functions

---

## Version History

- **v2.0** (Jan 6, 2026): Updated based on current codebase audit
- **v1.0**: Initial guidelines

---

**Questions?** Check existing implementations in `src/modules/` and `src/styles/components/` for reference patterns.
