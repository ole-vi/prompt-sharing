// ===== Session Tracking Module =====
// Tracks Jules sessions in Firestore for analytics and history

import { getAuth, getDb } from './firebase-service.js';
import { getServerTimestamp } from '../utils/firestore-helpers.js';
import { handleError, ErrorCategory } from '../utils/error-handler.js';
import { getJulesSession, getJulesSessionActivities, getDecryptedJulesKey, listJulesSessions } from './jules-api.js';
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
    
    // Find PR data in outputs array (could be at any index)
    const prOutput = session.outputs?.find(output => output.pullRequest);
    const pullRequest = prOutput?.pullRequest;

    const updates = {
      status: session.state || 'UNKNOWN',
      hasPR: !!pullRequest?.url,
      prUrl: pullRequest?.url || null,
      prTitle: pullRequest?.title || null,
      prDescription: pullRequest?.description || null
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
    // Get ALL sessions and filter in memory to avoid index requirements
    const db = getDb();
    const allSessionsSnapshot = await db
      .collection('juleSessions')
      .doc(user.uid)
      .collection('sessions')
      .get();
    
    const allSessions = allSessionsSnapshot.docs.map(doc => ({ 
      sessionId: doc.id, 
      ...doc.data() 
    }));
    
    // Filter to sessions that need syncing
    const toSync = allSessions.filter(session => {
      // Active or unknown status sessions
      if (['IN_PROGRESS', 'PLANNING', 'QUEUED', 'UNKNOWN'].includes(session.status)) return true;
      
      // Completed sessions without PR data
      if (session.status === 'COMPLETED') {
        if (session.hasPR === undefined || session.hasPR === null || session.hasPR === false) return true;
        if (!session.completedAt) return true;
        
        // Completed in last hour
        const completedTime = session.completedAt.toDate?.() || new Date(session.completedAt);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (completedTime > oneHourAgo) return true;
      }
      
      return false;
    });

    const apiKey = await getDecryptedJulesKey(user.uid);
    if (!apiKey) {
      console.warn('[Session Tracking] No API key found for sync');
      return;
    }

    console.log(`[Session Tracking] Syncing ${toSync.length} sessions`);

    for (const session of toSync) {
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

/**
 * Import all historical Jules sessions from API into Firestore
 * @returns {Promise<{imported: number, skipped: number, errors: number}>} Import stats
 */
export async function importJulesHistory() {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const db = getDb();
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  const apiKey = await getDecryptedJulesKey(user.uid);
  if (!apiKey) {
    throw new Error('Jules API key not found. Please add your API key in settings.');
  }

  const stats = { imported: 0, skipped: 0, errors: 0 };
  let pageToken = null;

  try {
    console.log('[Session Tracking] Starting Jules history import...');

    do {
      // Fetch page of sessions
      const response = await listJulesSessions(apiKey, 100, pageToken);
      const sessions = response.sessions || [];
      
      console.log(`[Session Tracking] Processing ${sessions.length} sessions...`);

      for (const session of sessions) {
        try {
          const sessionId = session.id;
          
          // Check if session already exists
          const sessionRef = db
            .collection('juleSessions')
            .doc(user.uid)
            .collection('sessions')
            .doc(sessionId);
          
          const existingDoc = await sessionRef.get();
          if (existingDoc.exists) {
            stats.skipped++;
            continue;
          }

          // Find PR data in outputs
          const prOutput = session.outputs?.find(output => output.pullRequest);
          const pullRequest = prOutput?.pullRequest;

          // Extract source and branch
          const sourceId = session.sourceContext?.source || null;
          const branch = session.sourceContext?.githubRepoContext?.startingBranch || null;

          // Create session document
          const sessionData = {
            sessionId,
            sessionName: session.name,
            title: session.title || 'Untitled Session',
            promptContent: session.prompt || '',
            promptPath: null, // Historical sessions don't have this
            sourceId,
            branch,
            status: session.state || 'UNKNOWN',
            sessionUrl: session.url || `https://jules.google.com/session/${sessionId}`,
            createdAt: session.createTime ? new Date(session.createTime) : getServerTimestamp(),
            completedAt: (session.state === 'COMPLETED' || session.state === 'FAILED') && session.updateTime 
              ? new Date(session.updateTime) 
              : null,
            hasPR: !!pullRequest?.url,
            prUrl: pullRequest?.url || null,
            prTitle: pullRequest?.title || null,
            prDescription: pullRequest?.description || null,
            imported: true,
            importedAt: getServerTimestamp()
          };

          await sessionRef.set(sessionData);
          stats.imported++;
          
          if (stats.imported % 10 === 0) {
            console.log(`[Session Tracking] Imported ${stats.imported} sessions so far...`);
          }
        } catch (err) {
          console.error(`[Session Tracking] Failed to import session ${session.id}:`, err);
          stats.errors++;
        }
      }

      pageToken = response.nextPageToken;
    } while (pageToken);

    console.log('[Session Tracking] Import complete:', stats);
    return stats;
  } catch (error) {
    console.error('[Session Tracking] History import failed:', error);
    handleError(error, { source: 'importJulesHistory' });
    throw error;
  }
}
