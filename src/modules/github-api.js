// ===== GitHub API Module =====

let viaProxy = (url) => url; // no proxy, fetch directly from GitHub

export function setViaProxy(proxyFn) {
  viaProxy = proxyFn;
}

export async function fetchJSON(url) {
  const res = await fetch(viaProxy(url), {
    cache: 'no-store',
    headers: { 'Accept': 'application/vnd.github+json' }
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(`GitHub API ${res.status} ${res.statusText} ${txt.slice(0, 140)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function listPromptsViaContents(owner, repo, branch, path = 'prompts') {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}&ts=${Date.now()}`;
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

export async function listPromptsViaTrees(owner, repo, branch) {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1&ts=${Date.now()}`;
  const data = await fetchJSON(url);
  const items = (data.tree || []).filter(n => n.type === 'blob' && /^prompts\/.+\.md$/i.test(n.path));
  return items.map(n => ({
    type: 'file',
    name: n.path.split('/').pop(),
    path: n.path,
    sha: n.sha
  }));
}

export async function fetchRawFile(owner, repo, branch, path) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}?ts=${Date.now()}`;
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
  const url = `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100&ts=${Date.now()}`;
  return fetchJSON(viaProxy(url));
}
