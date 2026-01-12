// ===== GitHub API Module =====

let viaProxy = (url) => url; // no proxy, fetch directly from GitHub

export function setViaProxy(proxyFn) {
  viaProxy = proxyFn;
}

/**
 * Get GitHub OAuth access token from localStorage
 * @returns {Promise<string|null>} The access token or null if not available
 */
async function getGitHubAccessToken() {
  try {
    // Check if user is logged in with GitHub
    if (!window.auth?.currentUser) {
      console.log('🔓 No authenticated user - using unauthenticated API calls (60/hr)');
      return null;
    }
    
    const providerData = window.auth.currentUser.providerData.find(
      provider => provider.providerId === 'github.com'
    );
    
    if (!providerData) {
      console.log('🔓 User not authenticated with GitHub - using unauthenticated API calls (60/hr)');
      return null;
    }
    
    // Get cached token from localStorage
    const tokenDataStr = localStorage.getItem('github_access_token');
    if (!tokenDataStr) {
      console.warn('⚠️ No GitHub OAuth token found. Sign out and sign in again to capture token.');
      return null;
    }
    
    const tokenData = JSON.parse(tokenDataStr);
    
    // GitHub OAuth tokens don't expire unless revoked, but we'll check if it's been
    // stored for more than 60 days and prompt re-authentication for security
    const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;
    const tokenAge = Date.now() - tokenData.timestamp;
    if (tokenAge > SIXTY_DAYS) {
      console.warn('⚠️ GitHub token is old (>60 days), consider re-authenticating');
      localStorage.removeItem('github_access_token');
      return null;
    }
    
    const ageDays = Math.floor(tokenAge / (24 * 60 * 60 * 1000));
    console.log(`🔐 Using authenticated GitHub API calls (5,000/hr) - token age: ${ageDays} days`);
    return tokenData.token;
  } catch (error) {
    console.error('Error getting GitHub access token:', error);
    return null;
  }
}

export async function fetchJSON(url) {
  try {
    const headers = { 'Accept': 'application/vnd.github+json' };
    
    // Add Authorization header if user is logged in with GitHub
    const token = await getGitHubAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const shortUrl = url.replace('https://api.github.com/', '');
    console.log(`📡 API Call: ${shortUrl} ${token ? '(authenticated ✓)' : '(unauthenticated)'}`);
    
    const res = await fetch(viaProxy(url), {
      cache: 'no-store',
      headers
    });
    
    // Log rate limit info from response headers
    const remaining = res.headers.get('x-ratelimit-remaining');
    const limit = res.headers.get('x-ratelimit-limit');
    if (remaining && limit) {
      const percentUsed = ((limit - remaining) / limit * 100).toFixed(1);
      console.log(`   Rate Limit: ${remaining}/${limit} remaining (${percentUsed}% used)`);
    }
    
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

function encodePathPreservingSlashes(path) {
  return String(path)
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

export async function listPromptsViaContents(owner, repo, branch, path = 'prompts') {
  const encodedPath = encodePathPreservingSlashes(path);
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}&ts=${Date.now()}`;
  const entries = await fetchJSON(url);
  if (!Array.isArray(entries)) return [];

  const results = [];
  for (const entry of entries) {
    if (entry.type === 'file' && /\.md$/i.test(entry.name)) {
      results.push({
        type: 'file',
        name: entry.name,
        path: entry.path,
        sha: entry.sha,
        download_url: entry.download_url
      });
    } else if (entry.type === 'dir') {
      const children = await listPromptsViaContents(owner, repo, branch, entry.path);
      results.push(...children);
    }
  }
  return results;
}

export async function listPromptsViaTrees(owner, repo, branch, path = 'prompts') {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1&ts=${Date.now()}`;
  const data = await fetchJSON(url);
  const pathRegex = new RegExp(`^${path}/.+\\.md$`, 'i');
  const items = (data.tree || []).filter(n => n.type === 'blob' && pathRegex.test(n.path));
  return items.map(n => ({
    type: 'file',
    name: n.path.split('/').pop(),
    path: n.path,
    sha: n.sha
  }));
}

export async function fetchRawFile(owner, repo, branch, path) {
  const encodedPath = encodePathPreservingSlashes(path);
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${encodedPath}?ts=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.text();
}

// ===== Gist Handling =====

const GIST_POINTER_REGEX = /^https:\/\/gist\.githubusercontent\.com\/\S+\/raw\/\S+$/i;
const GIST_URL_REGEX = /^https:\/\/gist\.github\.com\/[\w-]+\/[a-f0-9]+\/?(?:#file-[\w.-]+)?(?:\?file=[\w.-]+)?$/i;

export async function resolveGistRawUrl(gistUrl) {
  if (GIST_POINTER_REGEX.test(gistUrl)) {
    return gistUrl;
  }

  const match = gistUrl.match(/^https:\/\/gist\.github\.com\/([\w-]+)\/([a-f0-9]+)\/?(?:#file-([\w.-]+))?(?:\?file=([\w.-]+))?$/i);
  if (!match) {
    throw new Error('Invalid gist URL format');
  }

  const [, user, gistId, fragmentFile, queryFile] = match;
  const targetFile = fragmentFile || queryFile;

  if (targetFile) {
    return `https://gist.githubusercontent.com/${user}/${gistId}/raw/${targetFile}`;
  } else {
    const apiUrl = `https://api.github.com/gists/${gistId}`;
    const res = await fetch(viaProxy(apiUrl));
    if (!res.ok) {
      throw new Error(`Failed to fetch gist metadata: ${res.status}`);
    }
    const gistData = await res.json();
    const files = Object.keys(gistData.files);

    let bestFile = files.find(f => f.endsWith('.md')) || files[0];

    if (!bestFile) {
      throw new Error('No files found in gist');
    }

    return `https://gist.githubusercontent.com/${user}/${gistId}/raw/${bestFile}`;
  }
}

export async function fetchGistContent(gistUrl, cache = new Map()) {
  const cacheKey = `gist:${gistUrl}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  const url = gistUrl.includes('?')
    ? `${gistUrl}&ts=${Date.now()}`
    : `${gistUrl}?ts=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Gist fetch failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  cache.set(cacheKey, text);
  return text;
}

export function isGistPointer(text) {
  const trimmed = text.trim();
  return GIST_POINTER_REGEX.test(trimmed) || GIST_URL_REGEX.test(trimmed);
}

export function isGistUrl(url) {
  return GIST_POINTER_REGEX.test(url) || GIST_URL_REGEX.test(url);
}

export async function getBranches(owner, repo) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100&ts=${Date.now()}`;
  return fetchJSON(viaProxy(url));
}
