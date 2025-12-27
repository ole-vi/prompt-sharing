// ===== Jules Queue Service Module =====

import { clearCache, CACHE_KEYS } from '../utils/session-cache.js';

/**
 * Add an item to the user's Jules queue
 * @param {string} uid User ID
 * @param {object} queueItem The item to queue
 * @returns {Promise<string>} Document ID
 */
export async function addToJulesQueue(uid, queueItem) {
  if (!window.db) throw new Error('Firestore not initialized');
  try {
    const collectionRef = window.db.collection('julesQueues').doc(uid).collection('items');
    const docRef = await collectionRef.add({
      ...queueItem,
      autoOpen: queueItem.autoOpen !== false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    });
    // Clear cache so next load fetches fresh data
    clearCache(CACHE_KEYS.QUEUE_ITEMS, uid);
    return docRef.id;
  } catch (err) {
    console.error('Failed to add to queue', err);
    throw err;
  }
}

/**
 * Update a queue item
 * @param {string} uid User ID
 * @param {string} docId Document ID
 * @param {object} updates Updates to apply
 * @returns {Promise<boolean>} Success
 */
export async function updateJulesQueueItem(uid, docId, updates) {
  if (!window.db) throw new Error('Firestore not initialized');
  try {
    const docRef = window.db.collection('julesQueues').doc(uid).collection('items').doc(docId);
    await docRef.update(updates);
    // Clear cache so next load fetches fresh data
    clearCache(CACHE_KEYS.QUEUE_ITEMS, uid);
    return true;
  } catch (err) {
    console.error('Failed to update queue item', err);
    throw err;
  }
}

/**
 * Delete a queue item
 * @param {string} uid User ID
 * @param {string} docId Document ID
 * @returns {Promise<boolean>} Success
 */
export async function deleteFromJulesQueue(uid, docId) {
  if (!window.db) throw new Error('Firestore not initialized');
  try {
    await window.db.collection('julesQueues').doc(uid).collection('items').doc(docId).delete();
    // Clear cache so next load fetches fresh data
    clearCache(CACHE_KEYS.QUEUE_ITEMS, uid);
    return true;
  } catch (err) {
    console.error('Failed to delete queue item', err);
    throw err;
  }
}

/**
 * List all items in the user's queue
 * @param {string} uid User ID
 * @returns {Promise<Array>} List of queue items
 */
export async function listJulesQueue(uid) {
  if (!window.db) throw new Error('Firestore not initialized');
  try {
    const snapshot = await window.db.collection('julesQueues').doc(uid).collection('items').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Failed to list queue', err);
    throw err;
  }
}
