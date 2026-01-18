let submenuEl = null;
let activeSubmenuHeaders = new Set();
let currentOwner = null;
let currentRepo = null;
let currentBranch = null;

export function setContext(owner, repo, branch) {
  currentOwner = owner;
  currentRepo = repo;
  currentBranch = branch;
}

export function init() {
  createSubmenu();
  document.addEventListener('click', handleDocumentClick);
}

export function destroy() {
  document.removeEventListener('click', handleDocumentClick);
  if (submenuEl && submenuEl.parentNode) {
    submenuEl.parentNode.removeChild(submenuEl);
  }
  submenuEl = null;
  activeSubmenuHeaders.clear();
  currentOwner = null;
  currentRepo = null;
  currentBranch = null;
}

export function toggle(triggerElement, path) {
  if (!submenuEl) return;

  const header = triggerElement.closest('.tree-dir');
  const wasVisible = submenuEl.classList.contains('folder-submenu--visible');
  const isSamePath = submenuEl.dataset.currentPath === path;

  closeAll();

  // If it was visible and we clicked the same icon, we just closed it (toggle behavior).
  // If it was visible but different icon, or not visible, we open the new one.
  if (wasVisible && isSamePath) {
    return;
  }

  open(triggerElement, path, header);
}

function open(triggerElement, path, header) {
  const rect = triggerElement.getBoundingClientRect();
  submenuEl.dataset.currentPath = path;
  submenuEl.style.visibility = 'hidden';
  submenuEl.classList.add('folder-submenu--visible');

  const submenuRect = submenuEl.getBoundingClientRect();

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

  submenuEl.style.setProperty('--submenu-left', `${left}px`);
  submenuEl.style.setProperty('--submenu-top', `${top}px`);
  submenuEl.style.visibility = 'visible';

  if (header) {
    header.classList.add('submenu-open');
    activeSubmenuHeaders.add(header);
  }
}

function closeAll() {
  if (submenuEl) {
    submenuEl.classList.remove('folder-submenu--visible');
    submenuEl.style.visibility = '';
  }
  activeSubmenuHeaders.forEach(header => {
    header.classList.remove('submenu-open');
  });
  activeSubmenuHeaders.clear();
}

function createSubmenu() {
  if (submenuEl) return;

  submenuEl = document.createElement('div');
  submenuEl.className = 'folder-submenu';

  const makeMenuItem = (label, emoji, dataAction) => {
    const item = document.createElement('div');
    item.className = 'folder-submenu-item';
    item.innerHTML = `${emoji} ${label}`;
    item.dataset.action = dataAction;
    return item;
  };

  submenuEl.appendChild(makeMenuItem('Prompt (blank)', '<span class="icon icon-inline" aria-hidden="true">edit_note</span>', 'create-prompt'));
  submenuEl.appendChild(makeMenuItem('Conversation (template)', '<span class="icon icon-inline" aria-hidden="true">chat_bubble</span>', 'create-conversation'));

  document.body.appendChild(submenuEl);
}

function handleDocumentClick(event) {
  const target = event.target;
  const submenuItem = target.closest('.folder-submenu-item');

  if (submenuItem && submenuEl) {
    event.stopPropagation();
    const action = submenuItem.dataset.action;
    const path = submenuEl.dataset.currentPath;

    closeAll();

    if (action === 'create-prompt') {
      const newFilePath = path ? `${path}/new-prompt.md` : 'new-prompt.md';
      const ghUrl = `https://github.com/${currentOwner}/${currentRepo}/new/${currentBranch}?filename=${encodeURIComponent(newFilePath)}&ref=${encodeURIComponent(currentBranch)}`;
      window.open(ghUrl, '_blank', 'noopener,noreferrer');
    } else if (action === 'create-conversation') {
      const template = `**Conversation Link (Codex, Jules, etc):** [https://chatgpt.com/s/...]

### Prompt
[paste your full prompt here]

### Output
[response(s), context, notes, or follow-up thoughts]
`;
      const encoded = encodeURIComponent(template);
      const newFilePath = path ? `${path}/new-conversation.md` : 'new-conversation.md';
      const ghUrl = `https://github.com/${currentOwner}/${currentRepo}/new/${currentBranch}?filename=${encodeURIComponent(newFilePath)}&value=${encoded}&ref=${encodeURIComponent(currentBranch)}`;
      window.open(ghUrl, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  // If clicking outside, close.
  // Note: Clicks on the toggle button itself are handled in prompt-list.js (or whoever calls toggle),
  // but since prompt-list.js calls toggle() which handles logic, we just need to make sure we don't double close/open?
  // Wait, if I click the toggle button:
  // 1. prompt-list.js 'click' handler fires. It calls toggle().
  // 2. toggle() toggles the menu.
  // 3. Document 'click' handler fires (bubbling). It calls closeAll().
  // Result: Menu opens then immediately closes.
  // Fix: prompt-list.js calls event.stopPropagation().

  closeAll();
}
