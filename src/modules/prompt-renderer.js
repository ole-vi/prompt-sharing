import { slugify } from '../utils/slug.js';
import { isGistUrl, resolveGistRawUrl, fetchGistContent, fetchRawFile } from './github-api.js';
import { CODEX_URL_REGEX } from '../utils/constants.js';
import { setElementDisplay } from '../utils/dom-helpers.js';
import { ensureAncestorsExpanded, loadExpandedState, persistExpandedState, renderList, updateActiveItem, setCurrentSlug, getCurrentSlug, getFiles } from './prompt-list.js';

let cacheRaw = new Map();
let currentPromptText = null;
let handleTryInJulesCallback = null;

export function setHandleTryInJulesCallback(callback) {
  handleTryInJulesCallback = callback;
}

let contentEl = null;
let titleEl = null;
let metaEl = null;
let emptyEl = null;
let actionsEl = null;
let copyBtn = null;
let copenBtn = null;
let originalCopenLabel = null;
let rawBtn = null;
let ghBtn = null;
let editBtn = null;
let shareBtn = null;
let julesBtn = null;
let freeInputBtn = null;
let moreBtn = null;

export function initPromptRenderer() {
  contentEl = document.getElementById('content');
  titleEl = document.getElementById('title');
  metaEl = document.getElementById('meta');
  emptyEl = document.getElementById('empty');
  actionsEl = document.getElementById('actions');
  copyBtn = document.getElementById('copyBtn');
  copenBtn = document.getElementById('copenBtn');
  if (copenBtn) originalCopenLabel = copenBtn.innerHTML;
  rawBtn = document.getElementById('rawBtn');
  ghBtn = document.getElementById('ghBtn');
  editBtn = document.getElementById('editBtn');
  shareBtn = document.getElementById('shareBtn');
  julesBtn = document.getElementById('julesBtn');
  freeInputBtn = document.getElementById('freeInputBtn');
  moreBtn = document.getElementById('moreBtn');

  document.addEventListener('click', handleDocumentClick);
  window.addEventListener('branchChanged', handleBranchChanged);
}

export function destroyPromptRenderer() {
  document.removeEventListener('click', handleDocumentClick);
  window.removeEventListener('branchChanged', handleBranchChanged);
  cacheRaw.clear();
  currentPromptText = null;
  handleTryInJulesCallback = null;
}

function handleDocumentClick(event) {
  const target = event.target;
  const copenMenu = document.getElementById('copenMenu');
  const moreMenu = document.getElementById('moreMenu');

  if (target === copyBtn) {
    handleCopyPrompt();
    return;
  }

  if (target === copenBtn) {
    event.stopPropagation();
    if (copenMenu) {
      copenMenu.style.display = copenMenu.style.display === 'none' ? 'block' : 'none';
    }
    return;
  }

  const copenMenuItem = target.closest('.custom-dropdown-item[data-target]');
  if (copenMenuItem && copenMenu && copenMenuItem.parentElement === copenMenu) {
    event.stopPropagation();
    const targetApp = copenMenuItem.dataset.target;
    handleCopenPrompt(targetApp);
    copenMenu.style.display = 'none';
    return;
  }

  if (target === shareBtn) {
    handleShareLink();
    return;
  }

  if (target === julesBtn) {
    if (handleTryInJulesCallback) {
      handleTryInJulesCallback(currentPromptText);
    }
    return;
  }

  if (target === freeInputBtn) {
    (async () => {
      const { showFreeInputModal } = await import('./jules-free-input.js');
      showFreeInputModal();
    })();
    return;
  }

  if (target === moreBtn) {
    event.stopPropagation();
    if (moreMenu) {
      moreMenu.style.display = moreMenu.style.display === 'none' ? 'block' : 'none';
    }
    return;
  }

  const moreEditBtn = document.getElementById('moreEditBtn');
  const moreGhBtn = document.getElementById('moreGhBtn');
  const moreRawBtn = document.getElementById('moreRawBtn');

  if (target === moreEditBtn) {
    event.stopPropagation();
    if (editBtn && editBtn.href) {
      window.open(editBtn.href, '_blank', 'noopener,noreferrer');
    }
    if (moreMenu) moreMenu.style.display = 'none';
    return;
  }

  if (target === moreGhBtn) {
    event.stopPropagation();
    if (ghBtn && ghBtn.href) {
      window.open(ghBtn.href, '_blank', 'noopener,noreferrer');
    }
    if (moreMenu) moreMenu.style.display = 'none';
    return;
  }

  if (target === moreRawBtn) {
    event.stopPropagation();
    if (rawBtn && rawBtn.href) {
      window.open(rawBtn.href, '_blank', 'noopener,noreferrer');
    }
    if (moreMenu) moreMenu.style.display = 'none';
    return;
  }

  if (copenMenu) copenMenu.style.display = 'none';
  if (moreMenu) moreMenu.style.display = 'none';
}

async function handleBranchChanged() {
  setElementDisplay(titleEl, false);
  setElementDisplay(metaEl, false);
  setElementDisplay(actionsEl, false);
  setElementDisplay(emptyEl, false);
  if (contentEl) contentEl.innerHTML = '';
  setCurrentSlug(null);
  currentPromptText = null;
  updateActiveItem();
  const { showFreeInputForm } = await import('./jules-free-input.js');
  showFreeInputForm();
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
      editBtn.classList.add('hidden');
      editBtn.removeAttribute('href');
    }
    return;
  }

  const freeInputSection = document.getElementById('freeInputSection');
  if (freeInputSection) {
    freeInputSection.classList.add('hidden');
  }

  setElementDisplay(emptyEl, false);
  setElementDisplay(titleEl, true);
  setElementDisplay(metaEl, true);
  setElementDisplay(actionsEl, true);
  if (contentEl) {
    contentEl.classList.remove('hidden');
  }

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
  const moreEditBtn = document.getElementById('moreEditBtn');
  const moreGhBtn = document.getElementById('moreGhBtn');
  const moreRawBtn = document.getElementById('moreRawBtn');
  
  if (isGistContent && gistUrl) {
    editBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">edit</span> Edit Link';
    editBtn.title = 'Edit the gist link';
    if (moreEditBtn) moreEditBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">edit</span> Edit Link';
    
    ghBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">folder</span> View on Gist';
    ghBtn.title = 'Open the gist on GitHub';
    ghBtn.href = gistUrl;
    if (moreGhBtn) moreGhBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">folder</span> View on Gist';
    
    const blob = new Blob([raw], { type: 'text/plain' });
    const dataUrl = URL.createObjectURL(blob);
    rawBtn.href = dataUrl;
    rawBtn.removeAttribute('download');
    rawBtn.title = 'Open gist content in new tab';
  } else if (isCodexContent && codexUrl) {
    editBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">edit</span> Edit Link';
    editBtn.title = 'Edit the codex link';
    if (moreEditBtn) moreEditBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">edit</span> Edit Link';
    
    ghBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">chat_bubble</span> View on Codex';
    ghBtn.title = 'Open the conversation on Codex';
    ghBtn.href = codexUrl;
    ghBtn.target = '_blank';
    if (moreGhBtn) moreGhBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">chat_bubble</span> View on Codex';
    
    const blob = new Blob([codexUrl], { type: 'text/plain' });
    const dataUrl = URL.createObjectURL(blob);
    rawBtn.href = dataUrl;
    rawBtn.target = '_blank';
    rawBtn.removeAttribute('download');
    rawBtn.title = 'Open raw link in new tab';
  } else {
    editBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">edit</span> Edit on GitHub';
    editBtn.title = 'Edit the file on GitHub';
    if (moreEditBtn) moreEditBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">edit</span> Edit on GitHub';
    
    ghBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">folder</span> View on GitHub';
    ghBtn.title = 'Open the file on GitHub';
    ghBtn.href = `https://github.com/${owner}/${repo}/blob/${branch}/${f.path}`;
    if (moreGhBtn) moreGhBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">folder</span> View on GitHub';
    
    rawBtn.href = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${f.path}`;
    rawBtn.title = 'Open raw markdown';
  }
  editBtn.href = `https://github.com/${owner}/${repo}/edit/${branch}/${f.path}`;

  if (isCodexContent) {
    copyBtn.classList.add('hidden');
    shareBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">link</span> Copy link';
  } else {
    copyBtn.classList.remove('hidden');
    copyBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">content_copy</span> Copy prompt';
    shareBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">link</span> Copy link';
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
    if (pre.querySelector('.copy-code-btn')) return;
    const btn = document.createElement('button');
    btn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">content_copy</span>';
    btn.className = 'copy-code-btn';
    btn.dataset.action = 'copy-code';
    btn.title = 'Copy code';
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
    wrapper.appendChild(btn);
  });
  
  if (!contentEl.dataset.codeBlockListenerAttached) {
    contentEl.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-action="copy-code"]');
      if (btn) {
        const pre = btn.previousElementSibling;
        if (pre && pre.tagName === 'PRE') {
          const code = pre.innerText;
          try {
            await navigator.clipboard.writeText(code);
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">check_circle</span>';
            btn.classList.add('copied');
            setTimeout(() => {
              btn.innerHTML = originalHTML;
              btn.classList.remove('copied');
            }, 900);
          } catch {}
        }
      }
    });
    contentEl.dataset.codeBlockListenerAttached = 'true';
  }
}

async function handleCopyPrompt() {
  try {
    let contentToCopy;
    let buttonText;

    const isCodex = getCurrentPromptText() && CODEX_URL_REGEX.test(getCurrentPromptText().trim());
    if (isCodex) {
      contentToCopy = getCurrentPromptText();
      buttonText = '<span class="icon icon-inline" aria-hidden="true">content_copy</span> Copy link';
    } else {
      contentToCopy = getCurrentPromptText();
      buttonText = '<span class="icon icon-inline" aria-hidden="true">content_copy</span> Copy prompt';
    }

    await navigator.clipboard.writeText(contentToCopy);
    copyBtn.textContent = 'Copied';
    setTimeout(() => (copyBtn.innerHTML = buttonText), 1000);
  } catch {
    alert('Clipboard blocked. Select and copy manually.');
  }
}

async function handleCopenPrompt(target) {
  try {
    const promptText = getCurrentPromptText();
    if (!promptText) {
      alert('No prompt available.');
      return;
    }

    // Copy to clipboard
    await navigator.clipboard.writeText(promptText);
    copenBtn.textContent = 'Copied!';
    setTimeout(() => (copenBtn.innerHTML = originalCopenLabel), 1000);

    // Open appropriate tab based on target
    let url;
    switch(target) {
      case 'claude':
        url = 'https://claude.ai/code';
        break;
      case 'codex':
        url = 'https://chatgpt.com/codex';
        break;
      case 'gemini':
        url = 'https://gemini.google.com/app';
        break;
      case 'chatgpt':
        url = 'https://chatgpt.com/';
        break;
      case 'blank':
      default:
        url = 'about:blank';
        break;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    alert('Clipboard blocked. Could not copy prompt.');
  }
}

async function handleShareLink() {
  try {
    await navigator.clipboard.writeText(location.href);
    shareBtn.textContent = 'Link copied';
  } catch {
    alert('Could not copy link.');
  } finally {
    const originalText = '<span class="icon icon-inline" aria-hidden="true">link</span> Copy link';
    setTimeout(() => (shareBtn.innerHTML = originalText), 1000);
  }
}
