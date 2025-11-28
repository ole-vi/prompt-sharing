// ===== Prompt Renderer Module =====

import { slugify } from '../utils/slug.js';
import { isGistUrl, resolveGistRawUrl, fetchGistContent, fetchRawFile } from './github-api.js';
import { CODEX_URL_REGEX } from '../utils/constants.js';
import { setElementDisplay } from '../utils/dom-helpers.js';
import { ensureAncestorsExpanded, loadExpandedState, persistExpandedState, renderList, updateActiveItem, setCurrentSlug, getCurrentSlug, getFiles } from './prompt-list.js';

let cacheRaw = new Map();
let currentPromptText = null;

// Callbacks to avoid circular dependencies
let handleTryInJulesCallback = null;

export function setHandleTryInJulesCallback(callback) {
  handleTryInJulesCallback = callback;
}

// DOM elements
let contentEl = null;
let titleEl = null;
let metaEl = null;
let emptyEl = null;
let actionsEl = null;
let copyBtn = null;
let rawBtn = null;
let ghBtn = null;
let editBtn = null;
let shareBtn = null;
let julesBtn = null;
let freeInputBtn = null;

export function initPromptRenderer() {
  contentEl = document.getElementById('content');
  titleEl = document.getElementById('title');
  metaEl = document.getElementById('meta');
  emptyEl = document.getElementById('empty');
  actionsEl = document.getElementById('actions');
  copyBtn = document.getElementById('copyBtn');
  rawBtn = document.getElementById('rawBtn');
  ghBtn = document.getElementById('ghBtn');
  editBtn = document.getElementById('editBtn');
  shareBtn = document.getElementById('shareBtn');
  julesBtn = document.getElementById('julesBtn');
  freeInputBtn = document.getElementById('freeInputBtn');

  if (copyBtn) copyBtn.addEventListener('click', handleCopyPrompt);
  if (shareBtn) shareBtn.addEventListener('click', handleShareLink);
  if (julesBtn) {
    julesBtn.addEventListener('click', () => {
      if (handleTryInJulesCallback) {
        const promptText = currentPromptText || '';
        let title = '';
        const lines = promptText.split(/\r?\n/);
        if (lines.length > 0 && /^#\s+/.test(lines[0])) {
          title = lines[0].replace(/^#\s+/, '').trim();
        } else if (titleEl && titleEl.textContent) {
          title = titleEl.textContent.trim();
        } else if (lines.length > 0) {
          title = lines[0].substring(0, 50).trim();
        }
        handleTryInJulesCallback(currentPromptText, title);
      }
    });
  }
  if (freeInputBtn) {
    freeInputBtn.addEventListener('click', async () => {
      const { showFreeInputModal } = await import('./jules.js');
      showFreeInputModal();
    });
  }

  // Clear prompt when branch changes
  window.addEventListener('branchChanged', () => {
    // Show empty state
    setElementDisplay(emptyEl, true);
    setElementDisplay(titleEl, false);
    setElementDisplay(metaEl, false);
    setElementDisplay(actionsEl, false);

    // Clear content
    if (contentEl) contentEl.innerHTML = '';

    // Reset state
    setCurrentSlug(null);
    currentPromptText = null;
    updateActiveItem();
  });
}

export function getCurrentPromptText() {
  return currentPromptText;
}

export function setCurrentPromptText(text) {
  currentPromptText = text;
}

export async function selectBySlug(slug, files, owner, repo, branch) {
  try {
    const f = files.find(x => slugify(x.path) === slug);
    if (f) await selectFile(f, false, owner, repo, branch);
  } catch (error) {
    console.error('Error selecting file by slug:', error);
  }
}

export async function selectFile(f, pushHash, owner, repo, branch) {
  if (!f) {
    if (editBtn) {
      editBtn.style.display = 'none';
      editBtn.removeAttribute('href');
    }
    return;
  }

  setElementDisplay(emptyEl, false);
  setElementDisplay(titleEl, true);
  setElementDisplay(metaEl, true);
  setElementDisplay(actionsEl, true);

  titleEl.textContent = f.name.replace(/\.md$/i, '');
  metaEl.textContent = `File: ${f.path}`;

  const slug = slugify(f.path);
  if (pushHash) history.pushState(null, '', `#p=${encodeURIComponent(slug)}`);
  setCurrentSlug(slug);

  const expanded = ensureAncestorsExpanded(f.path);
  if (expanded) {
    renderList(getFiles(), owner, repo, branch);
  } else {
    updateActiveItem();
  }

  let raw;
  let isGistContent = false;
  let isCodexContent = false;
  let gistUrl = null;
  let codexUrl = null;

  let cached = cacheRaw.get(slug);
  if (cached) {
    if (typeof cached === 'string') {
      raw = cached;
    } else {
      if (cached.gistUrl) {
        isGistContent = true;
        gistUrl = cached.gistUrl;
        try {
          const finalRawUrl = cached.rawGistUrl || await resolveGistRawUrl(cached.gistUrl);
          const gistBody = await fetchGistContent(finalRawUrl, cacheRaw);
          raw = gistBody;
          cached.body = gistBody;
          cached.rawGistUrl = finalRawUrl;
        } catch (err) {
          console.error('Failed to refetch gist:', err);
          raw = cached.body || `Error loading gist: ${err.message}`;
        }
      } else if (cached.codexUrl) {
        isCodexContent = true;
        codexUrl = cached.codexUrl;
        raw = cached.body;
      } else {
        raw = cached.body || cached;
      }
    }
  } else {
    const text = await fetchRawFile(owner, repo, branch, f.path);
    const trimmed = text.trim();

    if (isGistUrl(trimmed)) {
      isGistContent = true;
      gistUrl = trimmed;
      try {
        const rawGistUrl = await resolveGistRawUrl(trimmed);
        const gistBody = await fetchGistContent(rawGistUrl, cacheRaw);
        raw = gistBody;
        cacheRaw.set(slug, { body: gistBody, gistUrl: trimmed, rawGistUrl });
      } catch (err) {
        console.error('Failed to fetch gist:', err);
        raw = text;
        cacheRaw.set(slug, { body: text, gistUrl: trimmed, error: err.message });
      }
    } else if (CODEX_URL_REGEX.test(trimmed)) {
      isCodexContent = true;
      codexUrl = trimmed;
      raw = trimmed;
      cacheRaw.set(slug, { body: raw, codexUrl: trimmed });
    } else {
      raw = text;
      cacheRaw.set(slug, raw);
    }
  }

  // Update button states and links
  if (isGistContent && gistUrl) {
    editBtn.textContent = '✏️ Edit Link';
    editBtn.title = 'Edit the gist link';
    ghBtn.textContent = '🗂️ View on Gist';
    ghBtn.title = 'Open the gist on GitHub';
    ghBtn.href = gistUrl;
    const blob = new Blob([raw], { type: 'text/plain' });
    const dataUrl = URL.createObjectURL(blob);
    rawBtn.href = dataUrl;
    rawBtn.removeAttribute('download');
    rawBtn.title = 'Open gist content in new tab';
  } else if (isCodexContent && codexUrl) {
    editBtn.textContent = '✏️ Edit Link';
    editBtn.title = 'Edit the codex link';
    ghBtn.textContent = '💬 View on Codex';
    ghBtn.title = 'Open the conversation on Codex';
    ghBtn.href = codexUrl;
    ghBtn.target = '_blank';
    const blob = new Blob([codexUrl], { type: 'text/plain' });
    const dataUrl = URL.createObjectURL(blob);
    rawBtn.href = dataUrl;
    rawBtn.target = '_blank';
    rawBtn.removeAttribute('download');
    rawBtn.title = 'Open raw link in new tab';
  } else {
    editBtn.textContent = '✏️ Edit on GitHub';
    editBtn.title = 'Edit the file on GitHub';
    ghBtn.textContent = '🗂️ View on GitHub';
    ghBtn.title = 'Open the file on GitHub';
    ghBtn.href = `https://github.com/${owner}/${repo}/blob/${branch}/${f.path}`;
    rawBtn.href = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${f.path}`;
    rawBtn.title = 'Open raw markdown';
  }
  editBtn.style.display = '';
  editBtn.href = `https://github.com/${owner}/${repo}/edit/${branch}/${f.path}`;

  if (isCodexContent) {
    copyBtn.style.display = 'none';
    shareBtn.textContent = '🔗 Copy link';
  } else {
    copyBtn.style.display = '';
    copyBtn.textContent = '📋 Copy prompt';
    shareBtn.textContent = '🔗 Copy link';
  }

  // Update title and content
  const firstLine = raw.split(/\r?\n/)[0];
  if (/^#\s+/.test(firstLine)) {
    titleEl.textContent = firstLine.replace(/^#\s+/, '');
  }

  if (isGistContent) {
    const looksLikeMarkdown = /^#|^\*|^-|^\d+\.|```/.test(raw.trim());
    if (!looksLikeMarkdown) {
      const wrappedContent = '```\n' + raw + '\n```';
      contentEl.innerHTML = marked.parse(wrappedContent, { breaks: true });
    } else {
      contentEl.innerHTML = marked.parse(raw, { breaks: true });
    }
  } else {
    contentEl.innerHTML = marked.parse(raw, { breaks: true });
  }

  setCurrentPromptText(raw);
  enhanceCodeBlocks();
}

function enhanceCodeBlocks() {
  const pres = contentEl.querySelectorAll('pre');
  pres.forEach((pre) => {
    if (pre.querySelector('.copy')) return;
    const btn = document.createElement('button');
    btn.textContent = 'Copy';
    btn.className = 'btn copy';
    btn.style.position = 'absolute';
    btn.style.margin = '6px';
    btn.style.right = '8px';
    btn.style.transform = 'translateY(-2px)';
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
    wrapper.appendChild(btn);
    btn.addEventListener('click', async () => {
      const code = pre.innerText;
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = 'Copied';
        setTimeout(() => (btn.textContent = 'Copy'), 900);
      } catch {}
    });
  });
}

async function handleCopyPrompt() {
  try {
    let contentToCopy;
    let buttonText;

    const isCodex = getCurrentPromptText() && CODEX_URL_REGEX.test(getCurrentPromptText().trim());
    if (isCodex) {
      contentToCopy = getCurrentPromptText();
      buttonText = '📋 Copy link';
    } else {
      contentToCopy = getCurrentPromptText();
      buttonText = '📋 Copy prompt';
    }

    await navigator.clipboard.writeText(contentToCopy);
    copyBtn.textContent = 'Copied';
    setTimeout(() => (copyBtn.textContent = buttonText), 1000);
  } catch {
    alert('Clipboard blocked. Select and copy manually.');
  }
}

async function handleShareLink() {
  try {
    await navigator.clipboard.writeText(location.href);
    shareBtn.textContent = 'Link copied';
  } catch {
    alert('Could not copy link.');
  } finally {
    const originalText = '🔗 Copy link';
    setTimeout(() => (shareBtn.textContent = originalText), 1000);
  }
}
