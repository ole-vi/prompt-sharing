// ===== All Constants, Regex Patterns, and Magic Strings =====

// App version - update this when releasing new versions
export const APP_VERSION = "1.0.0";

export const OWNER = "ole-vi";
export const REPO = "prompt-sharing";
export const BRANCH = "main";
export const PRETTY_TITLES = true;

// GitHub API
export const GIST_POINTER_REGEX = /^https:\/\/gist\.githubusercontent\.com\/\S+\/raw\/\S+$/i;
export const GIST_URL_REGEX = /^https:\/\/gist\.github\.com\/[\w-]+\/[a-f0-9]+\/?(?:#file-[\w.-]+)?(?:\?file=[\w.-]+)?$/i;
export const CODEX_URL_REGEX = /^https:\/\/chatgpt\.com\/s\/[a-f0-9_]+$/i;

// Jules API
export const JULES_API_BASE = "https://jules.googleapis.com/v1alpha";

export const DEFAULT_FAVORITE_REPOS = [
  { id: "sources/github/open-learning-exchange/planet", name: "open-learning-exchange/planet", emoji: "🌍", branch: "master" },
  { id: "sources/github/open-learning-exchange/myplanet", name: "open-learning-exchange/myplanet", emoji: "🚀", branch: "master" },
  { id: "sources/github/ole-vi/prompt-sharing", name: "ole-vi/prompt-sharing", emoji: "📝", branch: "main" }
];

export const STORAGE_KEY_FAVORITE_REPOS = "jules_favorite_repos";

// Emoji classification keywords
export const EMOJI_PATTERNS = {
  review: { emoji: "🔍", keywords: ["review", "pr", "rubric"] },
  bug: { emoji: "🩹", keywords: ["bug", "triage", "fix"] },
  design: { emoji: "🧭", keywords: ["spec", "design", "plan"] },
  refactor: { emoji: "🧹", keywords: ["refactor"] }
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
