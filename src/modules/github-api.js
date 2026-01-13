// ===== GitHub API Module =====

let viaProxy = (url) => url; // no proxy, fetch directly from GitHub

export function setViaProxy(proxyFn) {
  viaProxy = proxyFn;
}

const TOKEN_MAX_AGE = 60 * 24 * 60 * 60 * 1000; // 60 days

async function getGitHubAccessToken() {
  try {
    const user = window.auth?.currentUser;
    if (!user) return null;

    const isGitHubAuth = user.providerData.some(p => p.providerId === 'github.com');
    if (!isGitHubAuth) return null;

    const tokenDataStr = localStorage.getItem('github_access_token');
    if (!tokenDataStr) return null;

    const parsed = JSON.parse(tokenDataStr);
    const isObject = parsed !== null && typeof parsed === 'object';
    const token = isObject ? parsed.token : undefined;
    const timestamp = isObject ? parsed.timestamp : undefined;
    
    // Validate token is a non-empty string and timestamp is valid
    if (typeof token !== 'string' || !token || !Number.isFinite(timestamp)) {
      localStorage.removeItem('github_access_token');
      return null;
    }
    
    // Validate timestamp is not in the future and not expired
    const now = Date.now();
    if (timestamp > now || now - timestamp > TOKEN_MAX_AGE) {
      localStorage.removeItem('github_access_token');
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

export async function fetchJSON(url) {
  try {
    const headers = { 'Accept': 'application/vnd.github+json' };
    
    const token = await getGitHubAccessToken();
    if (token && typeof token === 'string' && token.length > 0) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetch(viaProxy(url), {
      cache: 'no-store',
      headers
    });
    
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
