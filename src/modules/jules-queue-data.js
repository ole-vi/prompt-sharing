import { addDoc, updateDoc, deleteDoc, queryCollection, setDoc, getDoc, getServerTimestamp, getFieldDelete } from '../utils/firestore-helpers.js';
import { getCache, setCache, CACHE_KEYS } from '../utils/session-cache.js';

let queueCache = [];

export function getQueueCache() {
  return queueCache;
}

export function setQueueCache(newCache) {
  queueCache = newCache;
}

export async function addToJulesQueue(uid, queueItem) {
  if (!window.db) throw new Error('Firestore not initialized');
  try {
    const collectionRef = window.db.collection('julesQueues').doc(uid).collection('items');
    // Pass object with userId to cacheKey
    const docId = await addDoc(collectionRef, {
      ...queueItem,
      autoOpen: queueItem.autoOpen !== false,
      createdAt: getServerTimestamp(),
      status: 'pending'
    }, { key: CACHE_KEYS.QUEUE_ITEMS, userId: uid });

    return docId;
  } catch (err) {
    console.error('Failed to add to queue', err);
    throw err;
  }
}

export async function updateJulesQueueItem(uid, docId, updates) {
  if (!window.db) throw new Error('Firestore not initialized');
  try {
    const collectionRef = window.db.collection('julesQueues').doc(uid).collection('items');
    await updateDoc(collectionRef, docId, updates, { key: CACHE_KEYS.QUEUE_ITEMS, userId: uid });
    return true;
  } catch (err) {
    console.error('Failed to update queue item', err);
    throw err;
  }
}

export async function deleteFromJulesQueue(uid, docId) {
  if (!window.db) throw new Error('Firestore not initialized');
  try {
    const collectionRef = window.db.collection('julesQueues').doc(uid).collection('items');
    await deleteDoc(collectionRef, docId, { key: CACHE_KEYS.QUEUE_ITEMS, userId: uid });
    return true;
  } catch (err) {
    console.error('Failed to delete queue item', err);
    throw err;
  }
}

export async function listJulesQueue(uid) {
  if (!window.db) throw new Error('Firestore not initialized');
  try {
    const collectionRef = window.db.collection('julesQueues').doc(uid).collection('items');
    const results = await queryCollection(collectionRef, {
      orderBy: { field: 'createdAt', direction: 'desc' }
    }, { key: CACHE_KEYS.QUEUE_ITEMS, userId: uid });
    return results;
  } catch (err) {
    console.error('Failed to list queue', err);
    throw err;
  }
}

export async function getUserTimeZone() {
  const user = window.auth?.currentUser;
  if (!user) return 'America/New_York';

  try {
    // Pass object with userId to cacheKey
    const profileData = await getDoc('userProfiles', user.uid, { key: CACHE_KEYS.USER_PROFILE, userId: user.uid });
    if (profileData && profileData.preferredTimeZone) {
      return profileData.preferredTimeZone;
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
    // Pass object with userId to cacheKey
    await setDoc('userProfiles', user.uid, {
      preferredTimeZone: timeZone,
      updatedAt: getServerTimestamp()
    }, { merge: true }, { key: CACHE_KEYS.USER_PROFILE, userId: user.uid });

    const cached = getCache(CACHE_KEYS.USER_PROFILE, user.uid) || {};
    setCache(CACHE_KEYS.USER_PROFILE, { ...cached, preferredTimeZone: timeZone }, user.uid);
  } catch (err) {
    console.warn('Failed to save timezone preference', err);
  }
}
