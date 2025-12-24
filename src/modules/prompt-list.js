// ===== Prompt List & Tree Module =====

import { slugify } from '../utils/slug.js';
import { STORAGE_KEYS, TAG_DEFINITIONS } from '../utils/constants.js';
import { listPromptsViaContents, listPromptsViaTrees } from './github-api.js';
import { clearElement, stopPropagation, setElementDisplay, toggleClass } from '../utils/dom-helpers.js';

let files = [];
let expandedState = new Set();
let expandedStateKey = null;
let openSubmenus = new Set();
let activeSubmenuHeaders = new Set();
let currentSlug = null;

// Store current repo context for event handlers
let currentOwner = null;
let currentRepo = null;
let currentBranch = null;

// Sidebar elements
let listEl = null;
let searchEl = null;

// Callback for selectFile - set by app.js to avoid circular dependency
let selectFileCallback = null;

export function setSelectFileCallback(callback) {
  selectFileCallback = callback;
}

export function setRepoContext(owner, repo, branch) {
  currentOwner = owner;
  currentRepo = repo;
  currentBranch = branch;
}

export function initPromptList() {
  listEl = document.getElementById('list');
  searchEl = document.getElementById('search');
  const searchClearBtn = document.getElementById('searchClear');
  
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      renderList(files, currentOwner, currentRepo, currentBranch);
      // Show/hide clear button based on input value
      if (searchClearBtn) {
        searchClearBtn.style.display = searchEl.value ? 'block' : 'none';
      }
    });
  }
  
  if (searchClearBtn && searchEl) {
    searchClearBtn.addEventListener('click', () => {
      searchEl.value = '';
      searchClearBtn.style.display = 'none';
      searchEl.focus();
      renderList(files, currentOwner, currentRepo, currentBranch);
    });
  }

  // Delegated event listener for tag badges
  listEl.addEventListener('click', (event) => {
    const badge = event.target.closest('.tag-badge');
    if (badge && searchEl) {
      event.preventDefault();
      event.stopPropagation();
      const tagKey = badge.dataset.tag;
      const label = TAG_DEFINITIONS[tagKey]?.label || tagKey;
      if (label) {
        searchEl.value = label;
        searchEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });
}

export function getFiles() {
  return files;
}

export function getCurrentSlug() {
  return currentSlug;
}

export function setCurrentSlug(slug) {
  currentSlug = slug;
}

export function ensureAncestorsExpanded(path) {
  const ancestors = ancestorPaths(path);
  let changed = false;
  for (const dir of ancestors) {
    if (!expandedState.has(dir)) {
      expandedState.add(dir);
      changed = true;
    }
  }
  if (changed) persistExpandedState();
  return changed;
}

function getCleanTitle(name) {
  return name.replace(/\.md$/i, "");
}

function getExpandedStateKey(owner, repo, branch) {
  return STORAGE_KEYS.expandedState(owner, repo, branch);
}

export function loadExpandedState(owner, repo, branch) {
  const key = getExpandedStateKey(owner, repo, branch);
  if (expandedStateKey === key) return;
  expandedStateKey = key;
  try {
    const raw = sessionStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    expandedState = new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    expandedState = new Set();
  }
  expandedState.add('prompts');
}

export function persistExpandedState() {
  // sessionStorage: expanded state is per-session (cleared on refresh)
  // This prevents expanded folders from persisting after page reload
  const key = expandedStateKey;
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify([...expandedState]));
  } catch {}
}

export function toggleDirectory(path, expand) {
  const before = expandedState.has(path);
  if (expand) {
    expandedState.add(path);
  } else {
    expandedState.delete(path);
  }
  if (before !== expand) {
    persistExpandedState();
  }
  renderList(files, currentOwner, currentRepo, currentBranch);
}

function closeAllSubmenus() {
  openSubmenus.forEach(submenu => {
    submenu.style.display = 'none';
  });
  activeSubmenuHeaders.forEach(header => {
    header.classList.remove('submenu-open');
  });
  openSubmenus.clear();
  activeSubmenuHeaders.clear();
}

function ancestorPaths(path) {
  const parts = path.split('/');
  const ancestors = [];
  for (let i = 0; i < parts.length - 1; i++) {
    ancestors.push(parts.slice(0, i + 1).join('/'));
  }
  return ancestors;
}

function getPromptFolder(branch) {
  return branch === 'web-captures' ? 'webcaptures' : 'prompts';
}

function buildTree(items, folder = 'prompts') {
  const root = { type: 'dir', name: folder, path: folder, children: new Map() };
  for (const item of items) {
    if (!item.path) continue;
    const relative = item.path.replace(new RegExp(`^${folder}/?`), '');
    const segments = relative.split('/');
    let node = root;
    let currentPath = folder;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isFile = i === segments.length - 1;
      if (isFile) {
        node.children.set(segment, { ...item, type: 'file' });
      } else {
        currentPath = `${currentPath}/${segment}`;
        if (!node.children.has(segment)) {
          node.children.set(segment, {
            type: 'dir',
            name: segment,
            path: currentPath,
            children: new Map()
          });
        }
        node = node.children.get(segment);
      }
    }
  }
  return root;
}

function renderTree(node, container, forcedExpanded, owner, repo, branch) {
  const entries = Array.from(node.children.values());
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    const aName = (a.name || '').toLowerCase();
    const bName = (b.name || '').toLowerCase();
    return aName.localeCompare(bName);
  });

  for (const entry of entries) {
    if (entry.type === 'dir') {
      const li = document.createElement('li');
      const header = document.createElement('div');
      header.className = 'tree-dir';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      const isForced = forcedExpanded.has(entry.path);
      const isExpanded = isForced || expandedState.has(entry.path);
      toggle.textContent = isExpanded ? '▾' : '▸';
      toggle.addEventListener('click', (ev) => {
        stopPropagation(ev);
        toggleDirectory(entry.path, !isExpanded);
      });

      header.addEventListener('click', (ev) => {
        stopPropagation(ev);
        toggleDirectory(entry.path, !isExpanded);
      });

      const label = document.createElement('span');
      label.className = 'folder-name';
      label.textContent = entry.name;

      const iconsContainer = document.createElement('div');
      iconsContainer.className = 'folder-icons';

      const ghIcon = document.createElement('span');
      ghIcon.className = 'github-folder-icon';
      ghIcon.textContent = '🗂️';
      ghIcon.title = 'Open directory on GitHub';
      ghIcon.addEventListener('click', (ev) => {
        stopPropagation(ev);
        const ghUrl = `https://github.com/${owner}/${repo}/tree/${branch}/${entry.path}`;
        window.open(ghUrl, '_blank', 'noopener,noreferrer');
      });

      const addIcon = document.createElement('span');
      addIcon.className = 'add-file-icon';
      addIcon.textContent = '+';
      addIcon.title = 'Create new file in this directory';

      const submenu = document.createElement('div');
      submenu.style.position = 'absolute';
      submenu.style.background = 'var(--card)';
      submenu.style.border = '1px solid var(--border)';
      submenu.style.borderRadius = '8px';
      submenu.style.padding = '6px 0';
      submenu.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
      submenu.style.display = 'none';
      submenu.style.zIndex = '10';

      const makeMenuItem = (label, emoji, onClick) => {
        const item = document.createElement('div');
        item.textContent = `${emoji} ${label}`;
        item.style.padding = '6px 14px';
        item.style.cursor = 'pointer';
        item.style.fontSize = '13px';
        item.style.color = 'var(--text)';
        item.addEventListener('mouseenter', () => item.style.background = '#1a1f35');
        item.addEventListener('mouseleave', () => item.style.background = 'transparent');
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          submenu.style.display = 'none';
          onClick();
        });
        return item;
      };

      submenu.appendChild(makeMenuItem("Prompt (blank)", "📝", () => {
        const newFilePath = entry.path ? `${entry.path}/new-prompt.md` : 'new-prompt.md';
        // GitHub's /new/{branch} endpoint: uses branch if it exists on the repo
        // Include ref parameter to ensure correct branch is selected in the web UI
        const ghUrl = `https://github.com/${owner}/${repo}/new/${branch}?filename=${encodeURIComponent(newFilePath)}&ref=${encodeURIComponent(branch)}`;
        window.open(ghUrl, '_blank', 'noopener,noreferrer');
      }));

      submenu.appendChild(makeMenuItem("Conversation (template)", "💬", () => {
        const template = `**Conversation Link (Codex, Jules, etc):** [https://chatgpt.com/s/...]\n\n### Prompt\n[paste your full prompt here]\n\n### Additional Info\n[context, notes, or follow-up thoughts]\n`;
        const encoded = encodeURIComponent(template);
        const newFilePath = entry.path ? `${entry.path}/new-conversation.md` : 'new-conversation.md';
        // GitHub's /new/{branch} endpoint: uses branch if it exists on the repo
        // Include ref parameter to ensure correct branch is selected in the web UI
        const ghUrl = `https://github.com/${owner}/${repo}/new/${branch}?filename=${encodeURIComponent(newFilePath)}&value=${encoded}&ref=${encodeURIComponent(branch)}`;
        window.open(ghUrl, '_blank', 'noopener,noreferrer');
      }));

      document.body.appendChild(submenu);

      addIcon.addEventListener('click', (ev) => {
        stopPropagation(ev);

        const wasOpen = submenu.style.display === 'block';
        closeAllSubmenus();

        if (!wasOpen) {
          const rect = addIcon.getBoundingClientRect();

          submenu.style.display = 'block';
          submenu.style.visibility = 'hidden';
          const submenuRect = submenu.getBoundingClientRect();

          let left = rect.right;
          let top = rect.top;

          if (left + submenuRect.width > window.innerWidth - 10) {
            left = rect.left - submenuRect.width;
          }

          if (top + submenuRect.height > window.innerHeight - 10) {
            top = rect.bottom - submenuRect.height;
          }

          if (left < 10) {
            left = 10;
          }

          if (top < 10) {
            top = 10;
          }

          submenu.style.left = left + 'px';
          submenu.style.top = top + 'px';
          submenu.style.visibility = 'visible';
          openSubmenus.add(submenu);
          header.classList.add('submenu-open');
          activeSubmenuHeaders.add(header);
        }
      });

      document.addEventListener('click', () => closeAllSubmenus());

      iconsContainer.appendChild(ghIcon);
      iconsContainer.appendChild(addIcon);

      header.appendChild(toggle);
      header.appendChild(label);
      header.appendChild(iconsContainer);
      li.appendChild(header);

      const childList = document.createElement('ul');
      childList.style.display = isExpanded ? 'block' : 'none';
      li.appendChild(childList);
      renderTree(entry, childList, forcedExpanded, owner, repo, branch);
      if (!childList.children.length) {
        continue;
      }
      container.appendChild(li);
    } else {
      const file = entry;
      const li = document.createElement('li');
      const slug = slugify(file.path);
      const a = document.createElement('a');
      a.className = 'item';
      a.href = `#p=${encodeURIComponent(slug)}`;
      a.dataset.slug = slug;
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        if (selectFileCallback) {
          selectFileCallback(file, true, owner, repo, branch).catch(err => {
            console.error('Error selecting file:', err);
          });
        }
      });

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.flexDirection = 'column';
      left.style.gap = '2px';
      const t = document.createElement('div');
      t.className = 'item-title';
      t.textContent = getCleanTitle(file.name);
      left.appendChild(t);

      const tagContainer = document.createElement('div');
      tagContainer.className = 'tag-container';
      const addedTags = new Set();

      for (const [key, { label, className, keywords }] of Object.entries(TAG_DEFINITIONS)) {
        if (keywords.some(kw => new RegExp(kw, 'i').test(file.name))) {
          if (addedTags.has(key)) continue;

          const badge = document.createElement('span');
          badge.className = `tag-badge ${className}`;
          badge.textContent = label;
          badge.dataset.tag = key;

          tagContainer.appendChild(badge);
          addedTags.add(key);
        }
      }

      if (tagContainer.children.length > 0) {
        left.appendChild(tagContainer);
      }

      a.appendChild(left);
      li.appendChild(a);
      container.appendChild(li);
    }
  }
}

export function updateActiveItem() {
  const anchors = listEl.querySelectorAll('.item');
  anchors.forEach((a) => {
    if (a.dataset.slug === currentSlug) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });
}

export function renderList(items, owner, repo, branch) {
  loadExpandedState(owner, repo, branch);
  const q = searchEl && searchEl.value ? searchEl.value.trim().toLowerCase() : '';
  const searchActive = Boolean(q);
  const filtered = !q
    ? items.slice()
    : items.filter(f => {
        const name = f.name?.toLowerCase?.() || '';
        const path = f.path?.toLowerCase?.() || '';
        
        // Check if name or path matches
        if (name.includes(q) || path.includes(q)) return true;
        
        // Check if any tag matches
        for (const { label, keywords } of Object.values(TAG_DEFINITIONS)) {
          // Match tag label (e.g., "review", "bug")
          if (label.toLowerCase().includes(q)) {
            // Check if this file actually has this tag
            if (keywords.some(kw => new RegExp(kw, 'i').test(name))) {
              return true;
            }
          }
          // Match tag keywords directly in search (e.g., searching "fix" should find "bug" tagged items)
          if (keywords.some(kw => new RegExp(kw, 'i').test(name)) && keywords.some(kw => kw.toLowerCase().includes(q))) {
            return true;
          }
        }
        
        return false;
      });

  if (!filtered.length) {
    clearElement(listEl);
    listEl.innerHTML = '<div style="color:var(--muted); padding:8px;">No prompts found.</div>';
    return;
  }

  const forcedExpanded = new Set();
  if (searchActive) {
    for (const file of filtered) {
      for (const ancestor of ancestorPaths(file.path)) {
        forcedExpanded.add(ancestor);
      }
    }
  }

  clearElement(listEl);
  const rootList = document.createElement('ul');
  listEl.appendChild(rootList);
  const folder = getPromptFolder(branch);
  const tree = buildTree(filtered, folder);
  renderTree(tree, rootList, forcedExpanded, owner, repo, branch);
  updateActiveItem();
}

export async function loadList(owner, repo, branch, cacheKey) {
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      files = JSON.parse(cached);
      renderList(files, owner, repo, branch);
      refreshList(owner, repo, branch, cacheKey).catch(() => {});
      return files;
    }

    await refreshList(owner, repo, branch, cacheKey);
    return files;
  } catch (e) {
    const folder = getPromptFolder(branch);
    clearElement(listEl);
    listEl.innerHTML = `<div style="color:var(--muted); padding:8px;">
      Could not load prompts from <code>${owner}/${repo}@${branch}/${folder}</code>.<br/>${e.message}
    </div>`;
    return [];
  }
}

export async function refreshList(owner, repo, branch, cacheKey) {
  let data;
  const folder = getPromptFolder(branch);
  try {
    data = await listPromptsViaContents(owner, repo, branch, folder);
  } catch (e) {
    if (e.status === 403 || e.status === 404) {
      data = await listPromptsViaTrees(owner, repo, branch, folder);
    } else {
      throw e;
    }
  }
  files = (data || []).filter(x => x && x.type === 'file' && typeof x.path === 'string');
  sessionStorage.setItem(cacheKey, JSON.stringify(files));
  renderList(files, owner, repo, branch);
}
