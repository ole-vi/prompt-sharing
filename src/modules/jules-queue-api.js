import { JULES_MESSAGES } from '../utils/constants.js';
import { getCache, setCache, clearCache, CACHE_KEYS } from '../utils/session-cache.js';

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
    clearCache(CACHE_KEYS.QUEUE_ITEMS, uid);
    return docRef.id;
  } catch (err) {
    console.error('Failed to add to queue', err);
    throw err;
  }
}

export async function updateJulesQueueItem(uid, docId, updates) {
  if (!window.db) throw new Error('Firestore not initialized');
  try {
    const docRef = window.db.collection('julesQueues').doc(uid).collection('items').doc(docId);
    await docRef.update(updates);
    clearCache(CACHE_KEYS.QUEUE_ITEMS, uid);
    return true;
  } catch (err) {
    console.error('Failed to update queue item', err);
    throw err;
  }
}

export async function deleteFromJulesQueue(uid, docId) {
  if (!window.db) throw new Error('Firestore not initialized');
  try {
    await window.db.collection('julesQueues').doc(uid).collection('items').doc(docId).delete();
    clearCache(CACHE_KEYS.QUEUE_ITEMS, uid);
    return true;
  } catch (err) {
    console.error('Failed to delete queue item', err);
    throw err;
  }
}

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

export async function getUserTimeZone() {
  const user = window.auth?.currentUser;
  if (!user) return 'America/New_York';

  try {
    const profileDoc = await window.db.collection('userProfiles').doc(user.uid).get();
    if (profileDoc.exists && profileDoc.data().preferredTimeZone) {
      return profileDoc.data().preferredTimeZone;
    }
  } catch (err) {
    console.warn('Failed to fetch user timezone preference', err);
  }

  const cached = getCache(CACHE_KEYS.USER_PROFILE, user.uid);
  if (cached?.preferredTimeZone) {
    return cached.preferredTimeZone;
  }

  return 'America/New_York';
}

export async function saveUserTimeZone(timeZone) {
  const user = window.auth?.currentUser;
  if (!user) return;

  try {
    await window.db.collection('userProfiles').doc(user.uid).set({
      preferredTimeZone: timeZone,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const cached = getCache(CACHE_KEYS.USER_PROFILE, user.uid) || {};
    setCache(CACHE_KEYS.USER_PROFILE, { ...cached, preferredTimeZone: timeZone }, user.uid);
  } catch (err) {
    console.warn('Failed to save timezone preference', err);
  }
}
