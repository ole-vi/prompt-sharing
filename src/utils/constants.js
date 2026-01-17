// ===== All Constants, Regex Patterns, and Magic Strings =====

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

// UI text
export const UI_TEXT = {
  LOADING: "Loading...",
  SIGN_IN: "Sign in with GitHub",
  SIGN_OUT: "Sign Out",
  COPY_PROMPT: "📋 Copy prompt",
  COPIED: "Copied",
  COPY_LINK: "🔗 Copy link",
  LINK_COPIED: "Link copied",
  TRY_JULES: "⚡ Try in Jules",
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
 */

/**
 * Timeouts for various UI and network operations.
 * @type {Timeouts}
 */
export const TIMEOUTS = {
  statusBar: 3000,
  fetch: 5000
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
