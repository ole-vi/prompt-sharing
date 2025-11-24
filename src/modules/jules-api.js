// ===== Jules API Client Module =====
// Provides access to the Jules API for managing sources, sessions, and activities

import { JULES_API_BASE, ERRORS } from '../utils/constants.js';

/**
 * Decrypts and retrieves the user's stored Jules API key
 * @param {string} uid - User ID
 * @returns {Promise<string|null>} The decrypted API key or null if not found
 */
export async function getDecryptedJulesKey(uid) {
  try {
    if (!window.db) {
      console.error('Firestore not initialized');
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
    console.error('Failed to decrypt Jules key:', error);
    return null;
  }
}

/**
 * Creates headers for Jules API requests with authentication
 * @param {string} apiKey - Jules API key
 * @returns {Object} Headers object for fetch requests
 */
function createJulesHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey
  };
}

/**
 * Lists all connected repositories (sources) in Jules
 * @param {string} apiKey - Jules API key
 * @returns {Promise<Object>} Response containing sources array
 */
export async function listJulesSources(apiKey) {
  try {
    const response = await fetch(`${JULES_API_BASE}/sources`, {
      headers: createJulesHeaders(apiKey)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sources: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error listing Jules sources:', error);
    throw error;
  }
}

/**
 * Gets details for a specific source including branches
 * @param {string} apiKey - Jules API key
 * @param {string} sourceId - Source identifier (e.g., "sources/github/owner/repo")
 * @returns {Promise<Object>} Source details with branches
 */
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
    console.error('Error getting Jules source details:', error);
    throw error;
  }
}

/**
 * Lists recent Jules sessions
 * @param {string} apiKey - Jules API key
 * @param {number} pageSize - Number of sessions to retrieve (default 10)
 * @param {string} pageToken - Optional page token for pagination
 * @returns {Promise<Object>} Response containing sessions array and nextPageToken
 */
export async function listJulesSessions(apiKey, pageSize = 10, pageToken = null) {
  try {
    const url = new URL(`${JULES_API_BASE}/sessions`);
    url.searchParams.set('pageSize', pageSize.toString());
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
    console.error('Error listing Jules sessions:', error);
    throw error;
  }
}

/**
 * Gets details for a specific session
 * @param {string} apiKey - Jules API key
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Session details with state and outputs
 */
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
    console.error('Error getting Jules session:', error);
    throw error;
  }
}

/**
 * Gets execution logs and activities for a session
 * @param {string} apiKey - Jules API key
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Activities and execution trace
 */
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
    console.error('Error getting Jules session activities:', error);
    throw error;
  }
}

/**
 * Creates a new Jules session (triggers prompt execution)
 * @param {string} apiKey - Jules API key
 * @param {Object} sessionConfig - Configuration for the session
 * @param {string} sessionConfig.prompt - The prompt to execute
 * @param {string} sessionConfig.sourceId - Source/repo identifier
 * @param {string} sessionConfig.branch - Branch name
 * @param {boolean} [sessionConfig.autoCreatePR] - Auto-create PR when true
 * @param {boolean} [sessionConfig.requirePlanApproval] - Require manual approval for plan
 * @returns {Promise<Object>} Created session object
 */
export async function createJulesSession(apiKey, sessionConfig) {
  try {
    const body = {
      prompt: sessionConfig.prompt,
      source: {
        id: sessionConfig.sourceId,
        branch: sessionConfig.branch
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
    console.error('Error creating Jules session:', error);
    throw error;
  }
}

/**
 * Approves a Jules session plan (when requirePlanApproval was set)
 * @param {string} apiKey - Jules API key
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Updated session
 */
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
    console.error('Error approving Jules session plan:', error);
    throw error;
  }
}

/**
 * Loads complete Jules profile information for a user
 * @param {string} uid - User ID
 * @returns {Promise<Object>} Profile data with sources, branches, and sessions
 */
export async function loadJulesProfileInfo(uid) {
  try {
    const apiKey = await getDecryptedJulesKey(uid);
    if (!apiKey) {
      throw new Error(ERRORS.JULES_KEY_REQUIRED);
    }

    // Fetch sources and sessions in parallel
    const [sourcesData, sessionsData] = await Promise.all([
      listJulesSources(apiKey),
      listJulesSessions(apiKey, 10)
    ]);

    // Fetch branch details for each source
    const sourcesWithBranches = await Promise.all(
      (sourcesData.sources || []).map(async (source) => {
        try {
          // Source object has both 'name' (full path like "sources/github/owner/repo") 
          // and 'id' fields. Use 'name' for the API call.
          const sourceIdentifier = source.name || source.id;
          console.log('[DEBUG] Fetching details for source:', sourceIdentifier);
          const details = await getJulesSourceDetails(apiKey, sourceIdentifier);
          return {
            ...source,
            branches: details.githubRepo?.branches || []
          };
        } catch (error) {
          console.error(`Failed to fetch branches for ${source.name || source.id}:`, error);
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
    console.error('Error loading Jules profile info:', error);
    throw error;
  }
}
