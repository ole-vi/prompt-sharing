import { slugify } from '../utils/slug.js';
import { STORAGE_KEYS, TAG_DEFINITIONS } from '../utils/constants.js';
import { debounce } from '../utils/debounce.js';
import { listPromptsViaContents, listPromptsViaTrees } from './github-api.js';
import { clearElement, stopPropagation, setElementDisplay, toggleClass } from '../utils/dom-helpers.js';
import * as folderSubmenu from './folder-submenu.js';
import { loadFuse } from '../utils/lazy-loaders.js';

let files = [];
let expandedState = new Set();
let expandedStateKey = null;
let currentSlug = null;
let currentOwner = null;
let currentRepo = null;
let currentBranch = null;
let listEl = null;
let searchEl = null;
let selectFileCallback = null;
let cachedFiles = null;
let cachedItemsWithTags = null;
let cachedFuseInstance = null;

export function setSelectFileCallback(callback) {
  selectFileCallback = callback;
}

export function setRepoContext(owner, repo, branch) {
  currentOwner = owner;
  currentRepo = repo;
  currentBranch = branch;
  folderSubmenu.setContext(owner, repo, branch);
}

export function initPromptList() {
  listEl = document.getElementById('list');
  searchEl = document.getElementById('search');
  const searchClearBtn = document.getElementById('searchClear');

  const debouncedRender = debounce(async () => {
    await renderList(files, currentOwner, currentRepo, currentBranch);
  }, 300);
  
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      // Immediate UI updates
      if (searchClearBtn) {
        if (searchEl.value) {
          searchClearBtn.classList.remove('hidden');
        } else {
          searchClearBtn.classList.add('hidden');
        }
      }
      // Debounced search
      debouncedRender();
    });
  }
  
  if (searchClearBtn && searchEl) {
    searchClearBtn.addEventListener('click', async () => {
      searchEl.value = '';
      searchClearBtn.classList.add('hidden');
      searchEl.focus();
      await renderList(files, currentOwner, currentRepo, currentBranch);
    });
  }
  folderSubmenu.init();
  listEl.addEventListener('click', handleListClick);
}

export function destroyPromptList() {
  folderSubmenu.destroy();
  files = [];
  expandedState.clear();
  currentSlug = null;
  currentOwner = null;
  currentRepo = null;
  currentBranch = null;
  selectFileCallback = null;
  cachedFiles = null;
  cachedItemsWithTags = null;
  cachedFuseInstance = null;
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
  } catch (error) {
    console.error('Error loading expanded state:', {
      error,
      context: 'loadExpandedState',
      owner, repo, branch
    });
    expandedState = new Set();
  }
  expandedState.add('prompts');
}

export function persistExpandedState() {
  const key = expandedStateKey;
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify([...expandedState]));
  } catch (error) {
    console.error('Error persisting expanded state:', {
      error,
      context: 'persistExpandedState',
      key
    });
  }
}

export async function toggleDirectory(path, expand) {
  const before = expandedState.has(path);
  if (expand) {
    expandedState.add(path);
  } else {
    expandedState.delete(path);
  }
  if (before !== expand) {
    persistExpandedState();
  }
  await renderList(files, currentOwner, currentRepo, currentBranch);
}

function handleListClick(event) {
  const target = event.target;
  const badge = target.closest('.tag-badge');
  if (badge && searchEl) {
    event.preventDefault();
    event.stopPropagation();
    const tagKey = badge.dataset.tag;
    const label = TAG_DEFINITIONS[tagKey]?.label || tagKey;
    if (label) {
      searchEl.value = label;
      searchEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }
  const toggleBtn = target.closest('[data-action="toggle-dir"]');
  if (toggleBtn) {
    event.stopPropagation();
    const path = toggleBtn.dataset.path;
    const isExpanded = expandedState.has(path);
    toggleDirectory(path, !isExpanded);
    return;
  }
  const treeDir = target.closest('.tree-dir');
  if (treeDir && !target.closest('.folder-icons')) {
    event.stopPropagation();
    const path = treeDir.dataset.path;
    if (path) {
      const isExpanded = expandedState.has(path);
      toggleDirectory(path, !isExpanded);
    }
    return;
  }
  const ghIcon = target.closest('[data-action="open-github"]');
  if (ghIcon) {
    event.stopPropagation();
    const path = ghIcon.dataset.path;
    const ghUrl = `https://github.com/${currentOwner}/${currentRepo}/tree/${currentBranch}/${path}`;
    window.open(ghUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  const addIcon = target.closest('[data-action="show-submenu"]');
  if (addIcon) {
    event.stopPropagation();
    const path = addIcon.dataset.path;
    folderSubmenu.toggle(addIcon, path);
    return;
  }
  const fileLink = target.closest('.item');
  if (fileLink) {
    event.preventDefault();
    const filePath = fileLink.dataset.path;
    
    if (selectFileCallback && filePath) {
      const file = files.find(f => f.path === filePath);
      if (file) {
        selectFileCallback(file, true, currentOwner, currentRepo, currentBranch).catch(err => {
          console.error('Error selecting file:', err);
        });
      }
    }
    return;
  }
}

function ancestorPaths(path) {
  const parts = path.split('/');
  const ancestors = [];
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join('/'));
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
      header.dataset.path = entry.path;

      const toggle = document.createElement('button');
      toggle.type = 'button';
      const isForced = forcedExpanded.has(entry.path);
      const isExpanded = isForced || expandedState.has(entry.path);
      toggle.innerHTML = isExpanded 
        ? '<span class="icon" aria-hidden="true">expand_more</span>'
        : '<span class="icon" aria-hidden="true">chevron_right</span>';
      toggle.dataset.action = 'toggle-dir';
      toggle.dataset.path = entry.path;

      const label = document.createElement('span');
      label.className = 'folder-name';
      label.textContent = entry.name;

      const iconsContainer = document.createElement('div');
      iconsContainer.className = 'folder-icons';

      const ghIcon = document.createElement('span');
      ghIcon.className = 'github-folder-icon icon icon-inline';
      ghIcon.textContent = 'folder';
      ghIcon.setAttribute('aria-hidden', 'true');
      ghIcon.title = 'Open directory on GitHub';
      ghIcon.dataset.action = 'open-github';
      ghIcon.dataset.path = entry.path;

      const addIcon = document.createElement('span');
      addIcon.className = 'add-file-icon icon icon-inline';
      addIcon.textContent = 'add';
      addIcon.setAttribute('aria-hidden', 'true');
      addIcon.title = 'Create new file in this directory';
      addIcon.dataset.action = 'show-submenu';
      addIcon.dataset.path = entry.path;

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
      a.dataset.path = file.path;

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

function createStatusMessage(message) {
  const container = createElement('div', 'color-muted pad-8');
  if (typeof message === 'string') {
    container.textContent = message;
  } else if (message instanceof Node) {
    container.appendChild(message);
  }
  return container;
}

export async function renderList(items, owner, repo, branch) {
  if (!Array.isArray(items)) {
    console.warn('renderList received non-array items:', items);
    items = [];
  }
  
  loadExpandedState(owner, repo, branch);
  const q = searchEl && searchEl.value ? searchEl.value.trim() : '';
  const searchActive = Boolean(q);

  // Ensure items is an array
  if (!Array.isArray(items)) {
    console.error('renderList received non-array items:', items);
    items = [];
  }

  let filtered = [];
  if (!q) {
    filtered = items.slice();
  } else {
    // Rebuild cache if items changed
    if (cachedFiles !== items) {
      cachedFiles = items;
      cachedItemsWithTags = items.map(item => {
        const tags = [];
        for (const tagKey in TAG_DEFINITIONS) {
          const tag = TAG_DEFINITIONS[tagKey];
          if (tag.keywords.some(kw => new RegExp(kw, 'i').test(item.name))) {
            tags.push(tag.label);
          }
        }
        return { ...item, tags };
      });
      cachedFuseInstance = null; // Clear old instance
    }
    
    // Lazy load Fuse only when actually searching
    if (!cachedFuseInstance) {
      const Fuse = await loadFuse();
      cachedFuseInstance = new Fuse(cachedItemsWithTags, {
        keys: ['name', 'path', 'tags'],
        includeScore: true,
        threshold: 0.4,
      });
    }
    
    filtered = cachedFuseInstance.search(q).map(result => result.item);
  }

  if (!filtered.length) {
    clearElement(listEl);
    listEl.appendChild(createStatusMessage('No prompts found.'));
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
    const now = Date.now();
    const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
    
    if (cached) {
      let cacheData;
      try {
        cacheData = JSON.parse(cached);
        if (!cacheData || typeof cacheData !== 'object' || Array.isArray(cacheData) || !Array.isArray(cacheData.files)) {
          console.warn('Old cache format detected, clearing cache');
          sessionStorage.removeItem(cacheKey);
          cacheData = null;
        }
      } catch (e) {
        console.warn('Corrupted cache data detected, clearing cache', e);
        sessionStorage.removeItem(cacheKey);
        cacheData = null;
      }
      
      if (cacheData) {
        const cacheAge = now - (cacheData.timestamp || 0);
        files = cacheData.files || [];
        await renderList(files, owner, repo, branch);
        
        if (cacheAge > CACHE_DURATION) {
          refreshList(owner, repo, branch, cacheKey).catch(error => {
            console.error('Background list refresh failed:', {
              error,
              context: 'loadList.backgroundRefresh',
              owner, repo, branch
            });
          });
        }
        
        return files;
      }
    }

    await refreshList(owner, repo, branch, cacheKey);
    return files;
  } catch (e) {
    const folder = getPromptFolder(branch);
    clearElement(listEl);

    const msgContainer = document.createElement('div');
    msgContainer.appendChild(document.createTextNode('Could not load prompts from '));
    const code = createElement('code', '', `${owner}/${repo}@${branch}/${folder}`);
    msgContainer.appendChild(code);
    msgContainer.appendChild(document.createElement('br'));
    msgContainer.appendChild(document.createTextNode(e.message));

    listEl.appendChild(createStatusMessage(msgContainer));
    return [];
  }
}

export async function refreshList(owner, repo, branch, cacheKey) {
  let result;
  const folder = getPromptFolder(branch);
  
  // Get cached ETag if available
  const cached = sessionStorage.getItem(cacheKey);
  let cachedETag = null;
  let parsedCache = null;
  
  if (cached) {
    try {
      parsedCache = JSON.parse(cached);
      // Validate cache structure - handle migration from old formats
      if (!parsedCache || typeof parsedCache !== 'object' || Array.isArray(parsedCache)) {
        console.warn('Old cache format detected, clearing cache');
        sessionStorage.removeItem(cacheKey);
        parsedCache = null;
      } else {
        cachedETag = parsedCache.etag || null;
      }
    } catch (e) {
      console.warn('Corrupted cache data detected, clearing cache', e);
      sessionStorage.removeItem(cacheKey);
    }
  }
  
  try {
    result = await listPromptsViaTrees(owner, repo, branch, folder, cachedETag);
    
    // If not modified, keep using cached data (0 API calls used!)
    if (result.notModified && parsedCache) {
      // Update timestamp to extend cache validity
      parsedCache.timestamp = Date.now();
      sessionStorage.setItem(cacheKey, JSON.stringify(parsedCache));
      return;
    }
    
    // New data received
    files = (result.files || []).filter(x => x && x.type === 'file' && typeof x.path === 'string');
  } catch (e) {
    console.warn('Trees API failed, using Contents fallback');
    try {
      const data = await listPromptsViaContents(owner, repo, branch, folder);
      files = (data || []).filter(x => x && x.type === 'file' && typeof x.path === 'string');
      result = { files, etag: null }; // Contents API doesn't provide ETag
    } catch (contentsError) {
      console.error('Both API strategies failed:', contentsError);
      throw contentsError;
    }
  }
  
  const cacheData = {
    files,
    etag: result.etag,
    timestamp: Date.now()
  };
  sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
  await renderList(files, owner, repo, branch);
}
