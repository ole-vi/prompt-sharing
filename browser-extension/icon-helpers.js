(function attachIconHelpers(global) {
  function createIcon(iconName, options = {}) {
    const { size = null, className = '', title = '' } = options;

    const classes = ['icon'];
    if (size) classes.push(`icon-${size}`);
    if (className) classes.push(className);

    const titleAttr = title ? ` title="${title}"` : '';

    return `<span class="${classes.join(' ')}" aria-hidden="true"${titleAttr}>${iconName}</span>`;
  }

  function createIconWithText(iconName, text, options = {}) {
    const iconOptions = { size: 'inline', ...options };
    return `${createIcon(iconName, iconOptions)} ${text}`;
  }

  function createIconButton(iconName, text = '', options = {}) {
    const { iconSize = 'inline' } = options;

    if (text) {
      return `<span class="icon icon-${iconSize}" aria-hidden="true">${iconName}</span> ${text}`;
    }

    return `<span class="icon" aria-hidden="true">${iconName}</span>`;
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
    EDIT: 'edit',
    DELETE: 'delete',
    ADD: 'add',
    CLOSE: 'close',
    SYNC: 'sync',
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
