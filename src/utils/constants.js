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

// Hardcoded favorite branches (always favorites for all users)
export const HARDCODED_FAVORITE_BRANCHES = ["main", "web-captures"];

export const STORAGE_KEY_FAVORITE_BRANCHES = "favorite_branches";

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
