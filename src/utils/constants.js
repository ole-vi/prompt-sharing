// ===== All Constants, Regex Patterns, and Magic Strings =====

import { ICONS, createIconWithText } from './icon-helpers.js';

export const OWNER = "promptroot";
export const REPO = "promptroot";
export const BRANCH = "main";
export const PRETTY_TITLES = true;

// GitHub API
export const GIST_POINTER_REGEX = /^https:\/\/gist\.githubusercontent\.com\/\S+\/raw\/\S+$/i;
export const GIST_URL_REGEX = /^https:\/\/gist\.github\.com\/[\w-]+\/[a-f0-9]+\/?(?:#file-[\w.-]+)?(?:\?file=[\w.-]+)?$/i;
export const CODEX_URL_REGEX = /^https:\/\/chatgpt\.com\/s\/[a-f0-9_]+$/i;

// Jules API
export const JULES_API_BASE = "https://jules.googleapis.com/v1alpha";

export const DEFAULT_FAVORITE_REPOS = [];

export const STORAGE_KEY_FAVORITE_REPOS = "jules_favorite_repos";

// Tag definitions
export const TAG_DEFINITIONS = {
  review: {
    label: "Review",
    className: "tag-review",
    keywords: ["review", "\\bpr\\b", "rubric", "audit", "inspect", "check", "analyze", "investigation"]
  },
  bug: {
    label: "Bug",
    className: "tag-bug",
    keywords: ["bug", "triage", "fix", "issue", "solve", "repair", "patch", "hotfix"]
  },
  design: {
    label: "Design",
    className: "tag-design",
    keywords: ["spec", "design", "plan", "explorer", "guide", "tutorial", "documentation", "readme", "onboard"]
  },
  refactor: {
    label: "Refactor",
    className: "tag-refactor",
    keywords: ["refactor", "cleanup", "sweep", "maintenance", "optimize", "improve", "reorganize", "deadcode"]
  }
};

// Branch classification
export const USER_BRANCHES = ["dogi", "jesse", "saksham"];
export const FEATURE_PATTERNS = ["codex/", "feature/", "fix/", "bugfix/", "hotfix/"];

// SessionStorage keys
export const STORAGE_KEYS = {
  expandedState: (owner, repo, branch) => `sidebar:expanded:${owner}/${repo}@${branch}`,
  promptsCache: (owner, repo, branch) => `prompts:${owner}/${repo}@${branch}`,
  showFeatureBranches: "showFeatureBranches",
  showUserBranches: "showUserBranches"
};

// Error messages
export const ERRORS = {
  FIREBASE_NOT_READY: "Firebase not initialized. Please refresh.",
  GIST_FETCH_FAILED: "Failed to fetch gist content.",
  AUTH_REQUIRED: "Authentication required.",
  JULES_KEY_REQUIRED: "No Jules API key stored. Please save your API key first.",
  CLIPBOARD_BLOCKED: "Clipboard blocked. Select and copy manually."
};

// Jules toast messages
export const JULES_MESSAGES = {
  // Success messages
  QUEUED: "Prompt queued successfully!",
  QUEUE_UPDATED: "Queue item updated successfully",
  COMPLETED_RUNNING: "Completed running selected items",
  
  // Warning messages
  SIGN_IN_REQUIRED: "Please sign in to queue prompts.",
  SIGN_IN_REQUIRED_SUBTASKS: "Please sign in to queue subtasks.",
  NOT_SIGNED_IN: "Not signed in",
  NO_ITEMS_SELECTED: "No items selected",
  SELECT_REPO_FIRST: "Please select a repository first.",
  SELECT_BRANCH_FIRST: "Please select a branch first.",
  LOGIN_REQUIRED: "Login required to use Jules.",
  NOT_LOGGED_IN: "Not logged in.",
  
  // Info messages
  QUEUE_NOT_FOUND: "Queue item not found",
  
  // Cancellation messages
  cancelled: (processed, total) => 
    `Cancelled. Processed ${processed} of ${total} ${processed === 1 ? 'task' : 'tasks'} before cancellation.`,
  
  // Skip messages
  SKIPPED_SUBTASK: "Skipped subtask. Continuing with remaining...",
  
  // Success with count messages
  deleted: (count) => `Deleted ${count} ${count === 1 ? 'item' : 'items'}`,
  completedWithSkipped: (successful, skipped) => 
    `Completed ${successful} ${successful === 1 ? 'task' : 'tasks'}, skipped ${skipped}`,
  subtasksQueued: (count) => `${count} ${count === 1 ? 'subtask' : 'subtasks'} queued successfully!`,
  remainingQueued: (count) => `Queued ${count} remaining ${count === 1 ? 'subtask' : 'subtasks'}`,
  subtasksCancelled: (successful, total) => 
    `Cancelled. Submitted ${successful} of ${total} ${successful === 1 ? 'subtask' : 'subtasks'} before cancellation.`,
  
  // Error messages
  QUEUE_FAILED: (error) => `Failed to queue prompt: ${error}`,
  QUEUE_UPDATE_FAILED: (error) => `Failed to update queue item: ${error}`,
  DELETE_FAILED: (error) => `Failed to delete selected items: ${error}`,
  UNEXPECTED_ERROR: (error) => `Unexpected error: ${error}`,
  GENERAL_ERROR: "An error occurred. Please try again.",
  ERROR_WITH_MESSAGE: (message) => `An error occurred: ${message}`,
  FINAL_RETRY_FAILED: "Failed to submit task after multiple retries. Please try again later."
};

// UI text
export const UI_TEXT = {
  LOADING: "Loading...",
  SIGN_IN: "Sign in with GitHub",
  SIGN_OUT: "Sign Out",
  COPY_PROMPT: createIconWithText(ICONS.COPY, 'Copy prompt'),
  COPIED: "Copied",
  COPY_LINK: createIconWithText(ICONS.LINK, 'Copy link'),
  LINK_COPIED: "Link copied",
  TRY_JULES: createIconWithText(ICONS.JULES, 'Try in Jules'),
  RUNNING: "Running...",
  SAVE_KEY: "Save & Continue"
};

/**
 * @typedef {object} RetryConfig
 * @property {number} maxRetries - The maximum number of retries.
 * @property {number} baseDelay - The base delay in milliseconds for exponential backoff.
 */

/**
 * Configuration for retry logic.
 * @type {RetryConfig}
 */
export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000
};

/**
 * @typedef {object} Timeouts
 * @property {number} statusBar - The duration in milliseconds to display a status bar message.
 * @property {number} fetch - The timeout in milliseconds for fetch requests.
 * @property {number} componentCheck - Interval for checking if components are loaded (50ms).
 * @property {number} windowClose - Delay before closing the window (2000ms).
 * @property {number} uiDelay - Standard delay for UI updates to avoid flicker (500ms).
 * @property {number} longDelay - Long delay for retries or significant pauses (5000ms).
 * @property {number} toast - Default duration for toast messages (3000ms).
 * @property {number} copyFeedback - Duration to show "Copied!" feedback (1000ms).
 * @property {number} queueDelay - Delay between queue processing items (800ms).
 * @property {number} firebaseRetry - Interval for retrying Firebase initialization (100ms).
 * @property {number} modalFocus - Delay to set focus in modals (100ms).
 */

/**
 * Timeouts for various UI and network operations.
 * @type {Timeouts}
 */
export const TIMEOUTS = {
  statusBar: 3000,
  fetch: 5000,
  componentCheck: 50,
  windowClose: 2000,
  uiDelay: 500,
  longDelay: 5000,
  toast: 3000,
  copyFeedback: 1000,
  queueDelay: 800,
  firebaseRetry: 100,
  modalFocus: 100,
  actionFeedback: 2000
};

/**
 * @typedef {object} Limits
 * @property {number} firebaseMaxAttempts - Maximum attempts to initialize Firebase (300).
 * @property {number} componentMaxAttempts - Maximum attempts to wait for components (100).
 */

/**
 * Limits for various operations.
 * @type {Limits}
 */
export const LIMITS = {
  firebaseMaxAttempts: 300,
  componentMaxAttempts: 100
};

/**
 * @typedef {object} PageSizes
 * @property {number} julesSessions - The number of Jules sessions to fetch per page.
 * @property {number} branches - The number of branches to fetch per page.
 */

/**
 * Page sizes for paginated API calls.
 * @type {PageSizes}
 */
export const PAGE_SIZES = {
  julesSessions: 10,
  branches: 100
};

/**
 * @typedef {object} CacheDurations
 * @property {number} short - The duration in milliseconds for short-lived cache items.
 * @property {number} session - A flag indicating that the cache item should last for the session.
 */

/**
 * Cache durations for various data types.
 * @type {CacheDurations}
 */
export const CACHE_DURATIONS = {
  short: 300000, // 5 minutes
  session: 0
};

/**
 * Icon HTML strings for use in innerHTML.
 */
export const UI_ICONS = {
  check_circle: '<span class="icon icon-inline" aria-hidden="true">check_circle</span>',
  cancel: '<span class="icon icon-inline" aria-hidden="true">cancel</span>',
  hourglass_top: '<span class="icon icon-inline" aria-hidden="true">hourglass_top</span>',
  delete: '<span class="icon icon-inline" aria-hidden="true">delete</span>',
  refresh: '<span class="icon icon-inline" aria-hidden="true">refresh</span>',
  sync: '<span class="icon" aria-hidden="true">sync</span>',
  account_tree: '<span class="icon icon-inline" aria-hidden="true">account_tree</span>',
  folder: '<span class="icon icon-inline" aria-hidden="true">folder</span>',
  schedule: '<span class="icon icon-inline" aria-hidden="true">schedule</span>',
  pause_circle: '<span class="icon icon-inline" aria-hidden="true">pause_circle</span>',
  chat_bubble: '<span class="icon icon-inline" aria-hidden="true">chat_bubble</span>',
  help: '<span class="icon icon-inline" aria-hidden="true">help</span>',
  link: '<span class="icon icon-inline" aria-hidden="true">link</span>',
  info: '<span class="icon icon-inline" aria-hidden="true">info</span>',
  visibility: '<span class="icon" aria-hidden="true">visibility</span>',
  edit_note: '<span class="icon icon-inline" aria-hidden="true">edit_note</span>',
  settings: '<span class="icon icon-inline" aria-hidden="true">settings</span>',
  block: '<span class="icon icon-inline" aria-hidden="true">block</span>',
  list_alt: '<span class="icon icon-inline" aria-hidden="true">list_alt</span>',
  copy: '<span class="icon icon-inline" aria-hidden="true">content_copy</span>',
  edit: '<span class="icon icon-inline" aria-hidden="true">edit</span>',
  close: '<span class="icon" aria-hidden="true">close</span>',
  inventory_2: '<span class="icon icon-inline" aria-hidden="true">inventory_2</span>',
  error: '<span class="icon icon-inline" aria-hidden="true">error</span>',
  warning: '<span class="icon icon-inline" aria-hidden="true">warning</span>'
};

/**
 * Status and Toast messages.
 */
export const STATUS_MESSAGES = {
  NOT_LOGGED_IN: "Not logged in.",
  API_KEY_DELETED: "Jules API key has been deleted. You can enter a new one next time.",
  API_KEY_RESET_FAILED: "Failed to reset API key: ",
  LOAD_SOURCES_FAILED: "Failed to load sources: ",
  LOAD_SESSIONS_FAILED: "Failed to load sessions: ",
  API_KEY_NOT_FOUND: "Jules API key not found",
  NO_MATCHING_SESSIONS: "No sessions match your search",
  CLIPBOARD_BLOCKED_MANUAL: "Clipboard blocked. Select and copy manually.",
  NO_PROMPT_AVAILABLE: "No prompt available.",
  CLIPBOARD_BLOCKED_PROMPT: "Clipboard blocked. Could not copy prompt.",
  COPY_LINK_FAILED: "Could not copy link.",
  COPY_FAILED: "Failed to copy to clipboard",
  ITEM_MARKED_UNSCHEDULE: "Item marked for unscheduling. Click Save to confirm.",
  SUBTASK_SCHEDULE_WARNING: "Individual subtasks cannot be scheduled separately. Please select the parent batch to schedule all subtasks together.",
  NO_ITEMS_SCHEDULE: "No items selected to schedule",
  DATE_TIME_REQUIRED: "Date and time are required",
  SCHEDULE_FUTURE_ERROR: "Scheduled time must be in the future",
  SCHEDULED_SUCCESS: (count, date) => `Scheduled ${count} ${count === 1 ? 'item' : 'items'} for ${date}`,
  SCHEDULE_FAILED: "Failed to schedule items: ",
  UNSCHEDULED_SUCCESS: (count) => `${count} ${count === 1 ? 'item' : 'items'} unscheduled`,
  UNSCHEDULE_FAILED: "Failed to unschedule: ",
  PAUSING_QUEUE: "Pausing queue processing after the current subtask",
  PROCESSING_QUEUE: "Processing queue...",
  PAUSING_SUBTASK: "Pausing after current subtask",
  PAUSED_SAVED: "Paused — progress saved",
  PROCESSING_SUBTASK: (current, total) => `Processing subtask ${current}/${total}`,
  REMAINDER_QUEUED: "Remainder queued for later",
  LOADING_SOURCES: "Loading sources...",
  LOADING_SESSIONS: "Loading sessions...",
  NO_CONNECTED_REPOS: "No connected repositories found.",
  NO_RECENT_SESSIONS: "No recent sessions found.",
  LOADING: "Loading...",
  LOAD_MORE: "Load More",
  NO_SESSIONS_FOUND: "No sessions found",
  SAVED: "Saved",
  NOT_SAVED: "Not saved",
  DELETING: "Deleting...",
  DELETE_API_KEY: "Delete Jules API Key",
  RESET_API_KEY: "Reset Jules API Key",
  COPIED: "Copied",
  COPIED_EXCLAMATION: "Copied!",
  LINK_COPIED: "Link copied",
  COPY_PROMPT: "Copy prompt",
  COPY_LINK: "Copy link",
  EDIT_LINK: "Edit Link",
  VIEW_ON_GIST: "View on Gist",
  VIEW_ON_CODEX: "View on Codex",
  VIEW_ON_GITHUB: "View on GitHub",
  EDIT_ON_GITHUB: "Edit on GitHub",
  NO_BRANCHES: "No branches found",
  CONNECT_REPOS_HINT: "Connect repos in the Jules UI.",
  UNKNOWN_USER: "Unknown User",
  UNKNOWN: "Unknown"
};

/**
 * Modal configuration constants.
 */
export const MODAL_CONFIG = {
  DELETE_API_KEY: {
    title: 'Delete API Key',
    confirmText: 'Delete',
    confirmStyle: 'error',
    message: "This will delete your stored Jules API key. You'll need to enter a new one next time."
  },
  CONVERT_TO_SINGLE: {
    title: 'Convert to Single Prompt',
    confirmText: 'Convert',
    confirmStyle: 'warn',
    message: 'This will combine all subtasks into a single prompt. Continue?'
  },
  REMOVE_LAST_SUBTASK: {
    title: 'Remove Last Subtask',
    confirmText: 'Remove',
    confirmStyle: 'warn',
    message: 'This is the last subtask. Removing it will leave no subtasks. Continue?'
  },
  UNSAVED_CHANGES: {
    title: 'Unsaved Changes',
    confirmText: 'Close Anyway',
    confirmStyle: 'warn',
    message: 'You have unsaved changes. Are you sure you want to close?'
  },
  UNSCHEDULE_ITEMS: {
    title: 'Unschedule Items',
    confirmText: 'Unschedule',
    confirmStyle: 'warn',
    message: (count, itemText) => `Unschedule ${count} selected ${itemText}?`
  },
  DELETE_ITEMS: {
    title: 'Delete Items',
    confirmText: 'Delete',
    confirmStyle: 'error',
    message: (count) => `Delete ${count} selected item(s)?`
  }
};
