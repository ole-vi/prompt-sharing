// ===== Prompt List & Tree Module =====

import { slugify } from '../utils/slug.js';
import { STORAGE_KEYS, PRETTY_TITLES, EMOJI_PATTERNS } from '../utils/constants.js';
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
  if (searchEl) {
    searchEl.addEventListener('input', () => renderList(files, currentOwner, currentRepo, currentBranch));
  }
  document.addEventListener('click', () => closeAllSubmenus());
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

function prettyTitle(name) {
  const base = name.replace(/\.md$/i, "");
  if (!PRETTY_TITLES) return base;
  
  for (const [key, { emoji, keywords }] of Object.entries(EMOJI_PATTERNS)) {
    if (keywords.some(kw => new RegExp(kw, 'i').test(base))) {
      return emoji + " " + base;
    }
  }
  return base;
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

function buildTree(items) {
  const root = { type: 'dir', name: 'prompts', path: 'prompts', children: new Map() };
  for (const item of items) {
    if (!item.path) continue;
    const relative = item.path.replace(/^prompts\/?/, '');
    const segments = relative.split('/');
    let node = root;
    let currentPath = 'prompts';
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

function createSubmenu(header, entry, owner, repo, branch) {
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
      closeAllSubmenus();
      onClick();
    });
    return item;
  };

  submenu.appendChild(makeMenuItem("Prompt (blank)", "📝", () => {
    const newFilePath = entry.path ? `${entry.path}/new-prompt.md` : 'new-prompt.md';
    const ghUrl = `https://github.com/${owner}/${repo}/new/${branch}?filename=${encodeURIComponent(newFilePath)}&ref=${encodeURIComponent(branch)}`;
    window.open(ghUrl, '_blank', 'noopener,noreferrer');
  }));

  submenu.appendChild(makeMenuItem("Conversation (template)", "💬", () => {
    const template = `**Conversation Link (Codex, Jules, etc):** [https://chatgpt.com/s/...]\n\n### Prompt\n[paste your full prompt here]\n\n### Additional Info\n[context, notes, or follow-up thoughts]\n`;
    const encoded = encodeURIComponent(template);
    const newFilePath = entry.path ? `${entry.path}/new-conversation.md` : 'new-conversation.md';
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
      if (left < 10) left = 10;
      if (top < 10) top = 10;

      submenu.style.left = left + 'px';
      submenu.style.top = top + 'px';
      submenu.style.visibility = 'visible';
      openSubmenus.add(submenu);
      header.classList.add('submenu-open');
      activeSubmenuHeaders.add(header);
    }
  });

  return addIcon;
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

      const addIcon = createSubmenu(header, entry, owner, repo, branch);

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
      t.textContent = prettyTitle(file.name);
      left.appendChild(t);
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
        return name.includes(q) || path.includes(q);
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
  const tree = buildTree(filtered);
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
    clearElement(listEl);
    listEl.innerHTML = `<div style="color:var(--muted); padding:8px;">
      Could not load prompts from <code>${owner}/${repo}@${branch}/prompts</code>.<br/>${e.message}
    </div>`;
    return [];
  }
}

export async function refreshList(owner, repo, branch, cacheKey) {
  let data;
  try {
    data = await listPromptsViaContents(owner, repo, branch);
  } catch (e) {
    if (e.status === 403 || e.status === 404) {
      data = await listPromptsViaTrees(owner, repo, branch);
    } else {
      throw e;
    }
  }
  files = (data || []).filter(x => x && x.type === 'file' && typeof x.path === 'string');
  sessionStorage.setItem(cacheKey, JSON.stringify(files));
  renderList(files, owner, repo, branch);
}
