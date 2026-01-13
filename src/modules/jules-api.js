// ===== Jules API Client Module =====
// Provides access to the Jules API for managing sources, sessions, and activities

import { JULES_API_BASE, ERRORS, PAGE_SIZES } from '../utils/constants.js';
import { showToast } from './toast.js';

export async function getDecryptedJulesKey(uid) {
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

    return new TextDecoder().decode(plaintext);
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
  try {
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

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export async function getJulesSourceDetails(apiKey, sourceId) {
  try {
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
  } catch (error) {
    throw error;
  }
}

export async function listJulesSessions(apiKey, pageToken = null) {
  try {
    const url = new URL(`${JULES_API_BASE}/sessions`);
    url.searchParams.set('pageSize', PAGE_SIZES.julesSessions.toString());
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: createJulesHeaders(apiKey)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export async function getJulesSession(apiKey, sessionId) {
  try {
    const response = await fetch(`${JULES_API_BASE}/sessions/${sessionId}`, {
      headers: createJulesHeaders(apiKey)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch session: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export async function getJulesSessionActivities(apiKey, sessionId) {
  try {
    const response = await fetch(`${JULES_API_BASE}/sessions/${sessionId}/activities`, {
      headers: createJulesHeaders(apiKey)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch session activities: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export async function createJulesSession(apiKey, sessionConfig) {
  try {
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
  } catch (error) {
    throw error;
  }
}

export async function approveJulesSessionPlan(apiKey, sessionId) {
  try {
    const response = await fetch(`${JULES_API_BASE}/sessions/${sessionId}:approvePlan`, {
      method: 'POST',
      headers: createJulesHeaders(apiKey),
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`Failed to approve plan: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export async function loadJulesProfileInfo(uid) {
  try {
    const apiKey = await getDecryptedJulesKey(uid);
    if (!apiKey) {
      throw new Error(ERRORS.JULES_KEY_REQUIRED);
    }

    // Fetch sources and sessions in parallel
    const [sourcesData, sessionsData] = await Promise.all([
      listJulesSources(apiKey),
      listJulesSessions(apiKey)
    ]);

    // Fetch branch details for each source
    const sourcesWithBranches = await Promise.all(
      (sourcesData.sources || []).map(async (source) => {
        try {
          // Source object has both 'name' (full path like "sources/github/owner/repo") 
          // and 'id' fields. Use 'name' for the API call.
          const sourceIdentifier = source.name || source.id;
          const details = await getJulesSourceDetails(apiKey, sourceIdentifier);
          return {
            ...source,
            branches: details.githubRepo?.branches || []
          };
        } catch (error) {
          return {
            ...source,
            branches: []
          };
        }
      })
    );

    return {
      sources: sourcesWithBranches,
      sessions: sessionsData.sessions || []
    };
  } catch (error) {
    throw error;
  }
}

export async function callRunJulesFunction(promptText, sourceId, branch = 'master', title = '') {
  const user = window.auth ? window.auth.currentUser : null;
  if (!user) {
    showToast('Not logged in.', 'error');
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
      julesBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">smart_toy</span> Try in Jules';
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
        showToast('Login required to use Jules.', 'warn');
      }
      return;
    }
    await handleTryInJulesAfterAuth(promptText);
  } catch (error) {
    showToast('An error occurred: ' + error.message, 'error');
  }
}

export async function handleTryInJulesAfterAuth(promptText) {
  const user = window.auth ? window.auth.currentUser : null;
  if (!user) {
    showToast('Not logged in.', 'error');
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
    showToast('An error occurred. Please try again.', 'error');
  }
}
