(function attachIconHelpers(global) {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeClassTokens(value) {
    return String(value)
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean)
      .filter(t => /^[a-zA-Z0-9_-]+$/.test(t));
  }

  function createIcon(iconName, options = {}) {
    const { size = null, className = '', title = '' } = options;

    const classes = ['icon'];
    if (size && /^[a-zA-Z0-9_-]+$/.test(String(size))) classes.push(`icon-${String(size)}`);
    if (className) classes.push(...safeClassTokens(className));

    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';

    return `<span class="${escapeHtml(classes.join(' '))}" aria-hidden="true"${titleAttr}>${escapeHtml(iconName)}</span>`;
  }

  function createIconWithText(iconName, text, options = {}) {
    const iconOptions = { size: 'inline', ...options };
    return `${createIcon(iconName, iconOptions)} ${escapeHtml(text)}`;
  }

  function createIconButton(iconName, text = '', options = {}) {
    const { iconSize = 'inline' } = options;
    const safeIconSize = /^[a-zA-Z0-9_-]+$/.test(String(iconSize)) ? String(iconSize) : 'inline';

    if (text) {
      return `<span class="icon icon-${escapeHtml(safeIconSize)}" aria-hidden="true">${escapeHtml(iconName)}</span> ${escapeHtml(text)}`;
    }

    return `<span class="icon" aria-hidden="true">${escapeHtml(iconName)}</span>`;
  }

  const ICON_BUTTONS = {
    COPY_PROMPT: (iconName = 'content_copy') => createIconWithText(iconName, 'Copy prompt'),
    COPY_LINK: (iconName = 'link') => createIconWithText(iconName, 'Copy link'),
    EDIT: (iconName = 'edit') => createIconWithText(iconName, 'Edit'),
    DELETE: (iconName = 'delete') => createIconWithText(iconName, 'Delete'),
    SYNC: (iconName = 'sync') => createIcon(iconName),
    CLOSE: (iconName = 'close') => createIcon(iconName),
    LOADING: (iconName = 'hourglass_top') => createIconWithText(iconName, 'Loading...'),
    SUCCESS: (iconName = 'check_circle') => createIconWithText(iconName, 'Success'),
    ERROR: (iconName = 'error') => createIconWithText(iconName, 'Error'),
  };

  const ICONS = {
    COPY: 'content_copy',
    LINK: 'link',
    DOWNLOAD: 'download',
    EDIT: 'edit',
    DELETE: 'delete',
    ADD: 'add',
    CLOSE: 'close',
    SYNC: 'sync',
    LOGOUT: 'logout',
    REFRESH: 'refresh',

    CHECK: 'check_circle',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
    LOADING: 'hourglass_top',
    CANCEL: 'cancel',

    HOME: 'home',
    BACK: 'arrow_back',
    MENU: 'menu',

    FOLDER: 'folder',
    FILE: 'description',
    CODE: 'code',
    PHOTO: 'photo_camera',
    KEY: 'key',
    LOCK: 'lock',

    JULES: 'smart_toy',
    QUEUE: 'list_alt',
    SESSIONS: 'menu_book',
    PROFILE: 'person',
    REPO: 'inventory_2',
    BRANCH: 'account_tree',

    FREE_INPUT: 'edit_note',
    CHAT: 'chat_bubble',
    PUBLIC: 'public',
    FORUM: 'forum',
    MAGIC: 'auto_awesome',
    VISIBILITY: 'visibility',
  };

  global.IconHelpers = {
    createIcon,
    createIconWithText,
    createIconButton,
    ICON_BUTTONS,
    ICONS,
  };
})(window);
