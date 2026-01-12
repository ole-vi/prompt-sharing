// ===== Jules API Client Module =====
// Provides access to the Jules API for managing sources, sessions, and activities

import { JULES_API_BASE, ERRORS, PAGE_SIZES } from '../utils/constants.js';

// API key cache for memoization
const keyCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function clearJulesKeyCache(uid = null) {
  if (uid) {
    keyCache.delete(uid);
    console.log(`[Jules API] 🗑️ Cleared API key cache for user: ${uid}`);
  } else {
    keyCache.clear();
    console.log(`[Jules API] 🗑️ Cleared all API key caches`);
  }
}

export async function getDecryptedJulesKey(uid) {
  // Check cache first
  const cached = keyCache.get(uid);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    const age = Math.round((Date.now() - cached.timestamp) / 1000);
    console.log(`[Jules API] ✅ API key cache HIT (age: ${age}s)`);
    return cached.key;
  }

  console.log(`[Jules API] 🔑 Decrypting API key (cache miss)`);
  const startTime = performance.now();

  try {
    if (!window.db) {
      return null;
    }

    const doc = await window.db.collection('julesKeys').doc(uid).get();
    if (!doc.exists) {
      return null;
    }

    const { key: encrypted } = doc.data();
    if (!encrypted) return null;

    // Decrypt using same method as encryption
    const paddedUid = (uid + '\0'.repeat(32)).slice(0, 32);
    const keyData = new TextEncoder().encode(paddedUid);
    const key = await window.crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);

    const ivString = uid.slice(0, 12).padEnd(12, '0');
    const iv = new TextEncoder().encode(ivString).slice(0, 12);

    const ciphertextData = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const plaintext = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextData);

    const decryptedKey = new TextDecoder().decode(plaintext);
    
    // Cache the decrypted key
    keyCache.set(uid, { key: decryptedKey, timestamp: Date.now() });
    
    const decryptTime = Math.round(performance.now() - startTime);
    console.log(`[Jules API] ✅ API key decrypted and cached (${decryptTime}ms)`);
    
    return decryptedKey;
  } catch (error) {
    return null;
  }
}

function createJulesHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey
  };
}

export async function listJulesSources(apiKey, pageToken = null) {
  const startTime = performance.now();
  console.log(`[Jules API] 📡 Fetching sources...`);
  
  const url = new URL(`${JULES_API_BASE}/sources`);
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }
  
  const response = await fetch(url.toString(), {
    headers: createJulesHeaders(apiKey)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sources: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const elapsed = Math.round(performance.now() - startTime);
  const sourceCount = data.sources?.length || 0;
  const totalBranches = data.sources?.reduce((sum, s) => sum + (s.githubRepo?.branches?.length || 0), 0) || 0;
  console.log(`[Jules API] ✅ Fetched ${sourceCount} sources with ${totalBranches} total branches (${elapsed}ms)`);
  
  return data;
}

export async function getJulesSourceDetails(apiKey, sourceId) {
  // Source ID already contains the full path (e.g., "sources/github/owner/repo")
  // So we need to use it directly, not prepend /sources/
  const url = `${JULES_API_BASE}/${sourceId}`;
  const response = await fetch(url, {
    headers: createJulesHeaders(apiKey)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch source details: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function listJulesSessions(apiKey, pageSize = null, pageToken = null) {
  const startTime = performance.now();
  const requestedPageSize = pageSize || PAGE_SIZES.julesSessions;
  console.log(`[Jules API] 📡 Fetching sessions (pageSize: ${requestedPageSize})...`);
  
  const url = new URL(`${JULES_API_BASE}/sessions`);
  url.searchParams.set('pageSize', requestedPageSize.toString());
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }

  const response = await fetch(url.toString(), {
    headers: createJulesHeaders(apiKey)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const elapsed = Math.round(performance.now() - startTime);
  const sessionCount = data.sessions?.length || 0;
  console.log(`[Jules API] ✅ Fetched ${sessionCount} sessions (${elapsed}ms)`);
  
  return data;
}

export async function getJulesSession(apiKey, sessionId) {
  const response = await fetch(`${JULES_API_BASE}/sessions/${sessionId}`, {
    headers: createJulesHeaders(apiKey)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch session: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function getJulesSessionActivities(apiKey, sessionId) {
  const response = await fetch(`${JULES_API_BASE}/sessions/${sessionId}/activities`, {
    headers: createJulesHeaders(apiKey)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch session activities: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function createJulesSession(apiKey, sessionConfig) {
  const body = {
    prompt: sessionConfig.prompt,
    title: sessionConfig.title || '',
    sourceContext: {
      source: sessionConfig.sourceId,
      githubRepoContext: {
        startingBranch: sessionConfig.branch
      }
    }
  };

  if (sessionConfig.autoCreatePR) {
    body.automationMode = 'AUTO_CREATE_PR';
  }

  if (sessionConfig.requirePlanApproval !== undefined) {
    body.requirePlanApproval = sessionConfig.requirePlanApproval;
  }

  const response = await fetch(`${JULES_API_BASE}/sessions`, {
    method: 'POST',
    headers: createJulesHeaders(apiKey),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function approveJulesSessionPlan(apiKey, sessionId) {
  const response = await fetch(`${JULES_API_BASE}/sessions/${sessionId}:approvePlan`, {
    method: 'POST',
    headers: createJulesHeaders(apiKey),
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(`Failed to approve plan: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function loadJulesProfileInfo(uid) {
  console.log(`[Jules API] 🚀 Loading profile info for user...`);
  const overallStart = performance.now();
  
  const apiKey = await getDecryptedJulesKey(uid);
  if (!apiKey) {
    throw new Error(ERRORS.JULES_KEY_REQUIRED);
  }

  // Fetch sources and sessions in parallel
  // Note: listJulesSources already returns branch data in githubRepo.branches
  // This eliminates the need for N additional API calls (one per source)
  console.log(`[Jules API] 📡 Fetching sources and sessions in parallel...`);
  const [sourcesData, sessionsData] = await Promise.all([
    listJulesSources(apiKey),
    listJulesSessions(apiKey)
  ]);

  // No need to fetch branch details separately - they're already in the response
  const sources = sourcesData.sources || [];
  const sessions = sessionsData.sessions || [];
  
  const totalTime = Math.round(performance.now() - overallStart);
  const totalBranches = sources.reduce((sum, s) => sum + (s.githubRepo?.branches?.length || 0), 0);
  
  console.log(`[Jules API] ✅ Profile loaded: ${sources.length} sources, ${totalBranches} branches, ${sessions.length} sessions`);
  console.log(`[Jules API] ⚡ Total time: ${totalTime}ms (saved ${sources.length} redundant API calls!)`);
  
  return {
    sources,
    sessions
  };
}

export async function callRunJulesFunction(promptText, sourceId, branch = 'master', title = '') {
  const user = window.auth ? window.auth.currentUser : null;
  if (!user) {
    alert('Not logged in.');
    return null;
  }

  if (!sourceId) {
    throw new Error('No repository selected');
  }

  const julesBtn = document.getElementById('julesBtn');
  const originalText = julesBtn?.textContent;
  if (julesBtn) {
    julesBtn.textContent = 'Running...';
    julesBtn.disabled = true;
  }

  try {
    const sessionUrl = await runJulesAPI(promptText, sourceId, branch, title, user);
    
    if (julesBtn) {
      julesBtn.textContent = originalText;
      julesBtn.disabled = false;
    }

    return sessionUrl;
  } catch (error) {
    if (julesBtn) {
      julesBtn.textContent = '⚡ Try in Jules';
      julesBtn.disabled = false;
    }
    throw error;
  }
}

async function runJulesAPI(promptText, sourceId, branch, title, user) {
  const token = await user.getIdToken(true);
  const functionUrl = 'https://runjuleshttp-n7gaasoeoq-uc.a.run.app';

  const payload = { promptText: promptText || '', sourceId: sourceId, branch: branch, title: title };
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `HTTP ${response.status}`);
  }

  return result.sessionUrl || null;
}

export async function handleTryInJules(promptText) {
  try {
    const user = window.auth ? window.auth.currentUser : null;
    if (!user) {
      try {
        const { signInWithGitHub } = await import('./auth.js');
        await signInWithGitHub();
        setTimeout(() => handleTryInJulesAfterAuth(promptText), 500);
      } catch (error) {
        alert('Login required to use Jules.');
      }
      return;
    }
    await handleTryInJulesAfterAuth(promptText);
  } catch (error) {
    alert('An error occurred: ' + error.message);
  }
}

export async function handleTryInJulesAfterAuth(promptText) {
  const user = window.auth ? window.auth.currentUser : null;
  if (!user) {
    alert('Not logged in.');
    return;
  }

  try {
    const { checkJulesKey } = await import('./jules-keys.js');
    const { showJulesKeyModal, showJulesEnvModal } = await import('./jules-modal.js');
    
    const hasKey = await checkJulesKey(user.uid);
    
    if (!hasKey) {
      showJulesKeyModal(() => {
        showJulesEnvModal(promptText);
      });
    } else {
      showJulesEnvModal(promptText);
    }
  } catch (error) {
    alert('An error occurred. Please try again.');
  }
}
