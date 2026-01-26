// ===== Session Tracking Module =====
// Tracks Jules sessions in Firestore for analytics and history

import { getAuth, getDb } from './firebase-service.js';
import { getServerTimestamp } from '../utils/firestore-helpers.js';
import { handleError, ErrorCategory } from '../utils/error-handler.js';
import { getJulesSession, getJulesSessionActivities, getDecryptedJulesKey } from './jules-api.js';
import { CACHE_KEYS } from '../utils/session-cache.js';

/**
 * Track a new session in Firestore
 * @param {Object} sessionData - Session data to track
 * @param {string} sessionData.sessionId - Jules session ID
 * @param {string} sessionData.sessionName - Full session name (e.g., "sessions/123")
 * @param {string} sessionData.promptPath - Path to prompt file
 * @param {string} sessionData.promptContent - Full prompt text
 * @param {string} sessionData.sourceId - GitHub source ID
 * @param {string} sessionData.branch - Git branch
 * @param {string} sessionData.title - Session title
 * @param {string} sessionData.status - Session state
 * @param {string} [sessionData.queueItemId] - Optional queue item ID
 */
export async function trackSessionCreation(sessionData) {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const db = getDb();
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    // Calculate prompt hash for change detection
    const promptHash = await calculateHash(sessionData.promptContent || '');

    const sessionDoc = {
      // Identity
      sessionId: sessionData.sessionId,
      sessionName: sessionData.sessionName,
      
      // Source
      promptPath: sessionData.promptPath || null,
      promptHash: promptHash,
      promptContent: sessionData.promptContent || '',
      sourceId: sessionData.sourceId,
      branch: sessionData.branch,
      title: sessionData.title || '',
      
      // Status
      status: sessionData.status || 'UNKNOWN',
      
      // Outcomes (initial state)
      hasPR: false,
      prUrl: null,
      prTitle: null,
      prDescription: null,
      
      // Plan tracking
      hasPlan: false,
      planStepCount: 0,
      
      // Failure tracking
      failureStep: null,
      failureReason: null,
      
      // Timestamps
      createdAt: getServerTimestamp(),
      completedAt: null,
      lastSyncedAt: getServerTimestamp(),
      
      // Linkage
      queueItemId: sessionData.queueItemId || null,
      
      // Metadata
      userId: user.uid
    };

    await db
      .collection('juleSessions')
      .doc(user.uid)
      .collection('sessions')
      .doc(sessionData.sessionId)
      .set(sessionDoc);

    console.log('[Session Tracking] Created session:', sessionData.sessionId);
    return sessionData.sessionId;
  } catch (error) {
    handleError(error, { source: 'trackSessionCreation' });
    throw error;
  }
}

/**
 * Update session status and metadata
 * @param {string} sessionId - Jules session ID
 * @param {Object} updates - Fields to update
 */
export async function updateSessionStatus(sessionId, updates) {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const db = getDb();
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    const updateData = {
      ...updates,
      lastSyncedAt: getServerTimestamp()
    };

    await db
      .collection('juleSessions')
      .doc(user.uid)
      .collection('sessions')
      .doc(sessionId)
      .update(updateData);

    console.log('[Session Tracking] Updated session:', sessionId, updates);
  } catch (error) {
    handleError(error, { source: 'updateSessionStatus' });
    throw error;
  }
}

/**
 * Sync session status from Jules API
 * @param {string} sessionId - Jules session ID
 * @param {string} [apiKey] - Optional API key (will fetch if not provided)
 */
export async function syncSessionFromAPI(sessionId, apiKey = null) {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    // Get API key if not provided
    if (!apiKey) {
      apiKey = await getDecryptedJulesKey(user.uid);
      if (!apiKey) {
        throw new Error('Jules API key not found');
      }
    }

    // Fetch latest session data from Jules API
    const session = await getJulesSession(apiKey, sessionId);

    const updates = {
      status: session.state || 'UNKNOWN',
      hasPR: !!(session.outputs?.[0]?.pullRequest?.url),
      prUrl: session.outputs?.[0]?.pullRequest?.url || null,
      prTitle: session.outputs?.[0]?.pullRequest?.title || null,
      prDescription: session.outputs?.[0]?.pullRequest?.description || null
    };

    // Set completion time if completed or failed
    if ((session.state === 'COMPLETED' || session.state === 'FAILED') && !updates.completedAt) {
      updates.completedAt = getServerTimestamp();
    }

    await updateSessionStatus(sessionId, updates);

    // If completed/failed and we haven't analyzed activities yet, do it now
    const db = getDb();
    const sessionDoc = await db
      .collection('juleSessions')
      .doc(user.uid)
      .collection('sessions')
      .doc(sessionId)
      .get();

    const data = sessionDoc.data();
    if ((session.state === 'COMPLETED' || session.state === 'FAILED') && !data?.hasPlan) {
      await analyzeSessionActivities(sessionId, apiKey);
    }

    return session;
  } catch (error) {
    handleError(error, { source: 'syncSessionFromAPI' });
    throw error;
  }
}

/**
 * Analyze session activities and extract metrics
 * @param {string} sessionId - Jules session ID
 * @param {string} [apiKey] - Optional API key
 */
export async function analyzeSessionActivities(sessionId, apiKey = null) {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    // Get API key if not provided
    if (!apiKey) {
      apiKey = await getDecryptedJulesKey(user.uid);
      if (!apiKey) {
        throw new Error('Jules API key not found');
      }
    }

    // Fetch activities
    const activitiesData = await getJulesSessionActivities(apiKey, sessionId);
    const activities = activitiesData.activities || [];

    let hasPlan = false;
    let planStepCount = 0;
    let failureStep = null;
    let failureReason = null;

    // Analyze each activity
    for (const activity of activities) {
      // Check for plan generation
      if (activity.planGenerated) {
        hasPlan = true;
        planStepCount = activity.planGenerated.plan?.steps?.length || 0;
      }

      // Check for failures
      if (activity.artifacts) {
        for (const artifact of activity.artifacts) {
          if (artifact.bashOutput && artifact.bashOutput.exitCode !== 0) {
            failureStep = activity.progressUpdated?.title || 'Unknown step';
            failureReason = 'bash_error';
          }
        }
      }

      // Check for session completion failure
      if (activity.sessionCompleted && !activity.artifacts?.[0]?.changeSet) {
        failureReason = failureReason || 'no_changes_generated';
      }
    }

    const updates = {
      hasPlan,
      planStepCount,
      failureStep,
      failureReason,
      activitiesAnalyzed: true
    };

    await updateSessionStatus(sessionId, updates);

    console.log('[Session Tracking] Analyzed activities for session:', sessionId);
  } catch (error) {
    handleError(error, { source: 'analyzeSessionActivities' });
    throw error;
  }
}

/**
 * Get all sessions for the current user
 * @param {Object} options - Query options
 * @param {Date} [options.startDate] - Start date filter
 * @param {Date} [options.endDate] - End date filter
 * @param {string} [options.status] - Status filter
 * @returns {Promise<Array>} Array of session documents
 */
export async function getUserSessions(options = {}) {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const db = getDb();
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    let query = db
      .collection('juleSessions')
      .doc(user.uid)
      .collection('sessions')
      .orderBy('createdAt', 'desc');

    if (options.status) {
      query = query.where('status', '==', options.status);
    }

    if (options.startDate) {
      query = query.where('createdAt', '>=', options.startDate);
    }

    if (options.endDate) {
      query = query.where('createdAt', '<=', options.endDate);
    }

    const snapshot = await query.get();
    const sessions = [];

    snapshot.forEach(doc => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return sessions;
  } catch (error) {
    handleError(error, { source: 'getUserSessions' });
    throw error;
  }
}

/**
 * Sync all active (non-terminal) sessions
 */
export async function syncActiveSessions() {
  const user = getAuth()?.currentUser;
  if (!user) {
    return;
  }

  try {
    const activeSessions = await getUserSessions({
      status: 'IN_PROGRESS'
    });

    // Also get PLANNING and QUEUED sessions
    const planningSessions = await getUserSessions({ status: 'PLANNING' });
    const queuedSessions = await getUserSessions({ status: 'QUEUED' });

    const allActive = [...activeSessions, ...planningSessions, ...queuedSessions];

    const apiKey = await getDecryptedJulesKey(user.uid);
    if (!apiKey) {
      console.warn('[Session Tracking] No API key found for sync');
      return;
    }

    console.log(`[Session Tracking] Syncing ${allActive.length} active sessions`);

    for (const session of allActive) {
      try {
        await syncSessionFromAPI(session.sessionId, apiKey);
      } catch (err) {
        console.error(`[Session Tracking] Failed to sync session ${session.sessionId}:`, err);
      }
    }
  } catch (error) {
    handleError(error, { source: 'syncActiveSessions' });
  }
}

/**
 * Calculate SHA-256 hash of a string
 * @param {string} text - Text to hash
 * @returns {Promise<string>} Hex-encoded hash
 */
async function calculateHash(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Delete a session from tracking
 * @param {string} sessionId - Jules session ID
 */
export async function deleteTrackedSession(sessionId) {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const db = getDb();
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    await db
      .collection('juleSessions')
      .doc(user.uid)
      .collection('sessions')
      .doc(sessionId)
      .delete();

    console.log('[Session Tracking] Deleted session:', sessionId);
  } catch (error) {
    handleError(error, { source: 'deleteTrackedSession' });
    throw error;
  }
}
