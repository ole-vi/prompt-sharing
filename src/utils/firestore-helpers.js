import { getCache, setCache, clearCache } from './session-cache.js';
import { RETRY_CONFIG } from './constants.js';

const DB_NOT_INITIALIZED = 'Firestore not initialized';

function getDb() {
  if (typeof window !== 'undefined' && window.db) {
    return window.db;
  }
  if (typeof firebase !== 'undefined' && firebase.firestore) {
      return firebase.firestore();
  }
  throw new Error(DB_NOT_INITIALIZED);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function retryOperation(operation, retries = RETRY_CONFIG.maxRetries) {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (err) {
      if (i === retries - 1) throw err;
      const delay = RETRY_CONFIG.baseDelay * Math.pow(2, i);
      await sleep(delay);
    }
  }
}

/**
 * Get a single document with caching
 * @param {string} collectionPath - Collection path (e.g. 'users' or 'users/uid/settings')
 * @param {string} docId - Document ID
 * @param {string} [cacheKey] - Session storage cache key. If provided, checks cache first.
 * @returns {Promise<Object|null>} Document data with id or null
 */
export async function getDoc(collectionPath, docId, cacheKey = null) {
  if (cacheKey) {
    const cached = getCache(cacheKey);
    if (cached) return cached;
  }

  return retryOperation(async () => {
    const db = getDb();
    const snapshot = await db.collection(collectionPath).doc(docId).get();

    if (snapshot.exists) {
      const data = { id: snapshot.id, ...snapshot.data() };
      if (cacheKey) {
        setCache(cacheKey, data);
      }
      return data;
    }
    return null;
  });
}

/**
 * Query a collection with caching
 * @param {string} collectionPath - Collection path
 * @param {Object} options - Query options
 * @param {Array} [options.where] - Array of filters: [['field', 'op', 'value'], ...]
 * @param {Array|string} [options.orderBy] - Order by field or ['field', 'desc']
 * @param {number} [options.limit] - Limit results
 * @param {string} [cacheKey] - Session storage cache key
 * @returns {Promise<Array>} Array of document objects
 */
export async function queryCollection(collectionPath, options = {}, cacheKey = null) {
  if (cacheKey) {
    const cached = getCache(cacheKey);
    if (cached) return cached;
  }

  return retryOperation(async () => {
    const db = getDb();
    let query = db.collection(collectionPath);

    if (options.where) {
      options.where.forEach(w => {
        if (Array.isArray(w) && w.length === 3) {
          query = query.where(w[0], w[1], w[2]);
        }
      });
    }

    if (options.orderBy) {
      if (Array.isArray(options.orderBy)) {
         if (options.orderBy.length === 2) {
             query = query.orderBy(options.orderBy[0], options.orderBy[1]);
         } else {
             query = query.orderBy(options.orderBy[0]);
         }
      } else {
        query = query.orderBy(options.orderBy);
      }
    }

    if (options.limit) {
        query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (cacheKey) {
      setCache(cacheKey, results);
    }
    return results;
  });
}

/**
 * Set (create or overwrite) a document
 * @param {string} collectionPath
 * @param {string} docId - If null, will use add() (auto-id)
 * @param {Object} data
 * @param {Object} options
 * @param {boolean} [options.merge] - Merge data instead of overwrite
 * @param {string} [options.cacheKey] - Update this cache key (optimistic)
 * @param {string} [options.invalidateCacheKey] - Clear this cache key
 * @param {Object} [options.optimisticData] - Data to put in cache
 * @returns {Promise<string|void>} docId
 */
export async function setDoc(collectionPath, docId, data, options = {}) {
    if (options.cacheKey) {
        setCache(options.cacheKey, options.optimisticData || data);
    }
    if (options.invalidateCacheKey) {
        clearCache(options.invalidateCacheKey);
    }

    return retryOperation(async () => {
        const db = getDb();
        if (docId) {
             await db.collection(collectionPath).doc(docId).set(data, { merge: options.merge });
             return docId;
        } else {
             const ref = await db.collection(collectionPath).add(data);
             return ref.id;
        }
    });
}

/**
 * Add a document (wrapper for setDoc with null id)
 */
export async function addDoc(collectionPath, data, options = {}) {
    return setDoc(collectionPath, null, data, options);
}

/**
 * Update a document
 * @param {string} collectionPath
 * @param {string} docId
 * @param {Object} data
 * @param {Object} options
 * @param {string} [options.cacheKey] - Update this cache key
 * @param {string} [options.invalidateCacheKey] - Clear this cache key
 * @param {Object} [options.optimisticData] - Data to put in cache
 */
export async function updateDoc(collectionPath, docId, data, options = {}) {
    if (options.cacheKey && options.optimisticData) {
        setCache(options.cacheKey, options.optimisticData);
    }
    if (options.invalidateCacheKey) {
        clearCache(options.invalidateCacheKey);
    }

    return retryOperation(async () => {
        const db = getDb();
        await db.collection(collectionPath).doc(docId).update(data);
        return true;
    });
}

/**
 * Delete a document
 * @param {string} collectionPath
 * @param {string} docId
 * @param {Object} options
 * @param {string} [options.invalidateCacheKey] - Clear this cache key
 */
export async function deleteDoc(collectionPath, docId, options = {}) {
    if (options.invalidateCacheKey) {
        clearCache(options.invalidateCacheKey);
    }

    return retryOperation(async () => {
        const db = getDb();
        await db.collection(collectionPath).doc(docId).delete();
        return true;
    });
}

/**
 * Run a batch of operations
 * @param {Array<{type: 'set'|'update'|'delete', collection: string, docId: string, data?: Object, options?: Object}>} operations
 * @param {string} [cacheKeyToInvalidate]
 */
export async function runBatch(operations, cacheKeyToInvalidate = null) {
    if (cacheKeyToInvalidate) {
        clearCache(cacheKeyToInvalidate);
    }

    return retryOperation(async () => {
        const db = getDb();
        const batch = db.batch();

        operations.forEach(op => {
            const ref = db.collection(op.collection).doc(op.docId);
            if (op.type === 'set') {
                batch.set(ref, op.data, op.options);
            } else if (op.type === 'update') {
                batch.update(ref, op.data);
            } else if (op.type === 'delete') {
                batch.delete(ref);
            }
        });

        await batch.commit();
    });
}
