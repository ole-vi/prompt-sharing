// Polyfill globals for Node environment
global.sessionStorage = {
  store: {},
  getItem: function(key) { return this.store[key] || null; },
  setItem: function(key, value) { this.store[key] = value; },
  removeItem: function(key) { delete this.store[key]; },
  clear: function() { this.store = {}; }
};

global.window = {
    db: null
};

// Mock Firestore
const mockDocRef = {
  get: async () => ({ exists: false, id: 'test', data: () => ({}) }),
  set: async () => {},
  update: async () => {},
  delete: async () => {}
};

const mockCollectionRef = {
  doc: () => mockDocRef,
  add: async () => ({ id: 'new-id' }),
  where: function() { return this; },
  orderBy: function() { return this; },
  limit: function() { return this; },
  get: async () => ({ docs: [] })
};

const mockBatch = {
    set: () => {},
    update: () => {},
    delete: () => {},
    commit: async () => {}
};

global.window.db = {
  collection: (path) => mockCollectionRef,
  batch: () => mockBatch
};

// Import modules
import * as helpers from '../src/utils/firestore-helpers.js';
import * as assert from 'assert';

async function runTests() {
  console.log('Running Firestore Helpers Tests...');

  // Test 1: getDoc with cache miss then hit
  console.log('Test 1: getDoc caching');
  global.sessionStorage.clear();

  // Mock return value
  mockDocRef.get = async () => ({
      exists: true,
      id: 'doc1',
      data: () => ({ foo: 'bar' })
  });

  const result1 = await helpers.getDoc('col', 'doc1', 'cache_key_1');
  assert.strictEqual(result1.foo, 'bar');

  // Verify cache set
  const cached = JSON.parse(global.sessionStorage.getItem('cache_key_1'));
  assert.strictEqual(cached.data.foo, 'bar');

  // Modify cache to prove getDoc uses it
  global.sessionStorage.setItem('cache_key_1', JSON.stringify({ data: { foo: 'cached' }, timestamp: Date.now() }));
  const result2 = await helpers.getDoc('col', 'doc1', 'cache_key_1');
  assert.strictEqual(result2.foo, 'cached');
  console.log('PASS');

  // Test 2: queryCollection
  console.log('Test 2: queryCollection caching');
  global.sessionStorage.clear();
  mockCollectionRef.get = async () => ({
      docs: [{ id: 'd1', data: () => ({ val: 1 }) }]
  });

  const qResult1 = await helpers.queryCollection('col', {}, 'q_key');
  assert.strictEqual(qResult1.length, 1);
  assert.strictEqual(qResult1[0].val, 1);

  // Verify cache
  const qCached = JSON.parse(global.sessionStorage.getItem('q_key'));
  assert.strictEqual(qCached.data[0].val, 1);

  // Modify cache
  global.sessionStorage.setItem('q_key', JSON.stringify({ data: [{ id: 'd1', val: 999 }], timestamp: Date.now() }));
  const qResult2 = await helpers.queryCollection('col', {}, 'q_key');
  assert.strictEqual(qResult2[0].val, 999);
  console.log('PASS');

  // Test 3: setDoc optimistic update
  console.log('Test 3: setDoc optimistic update');
  global.sessionStorage.clear();

  await helpers.setDoc('col', 'doc2', { val: 'new' }, { cacheKey: 'doc2_key' });

  const setCached = JSON.parse(global.sessionStorage.getItem('doc2_key'));
  assert.strictEqual(setCached.data.val, 'new');
  console.log('PASS');

  // Test 4: retry logic (mock failure)
  console.log('Test 4: Retry logic');
  let attempts = 0;
  mockDocRef.get = async () => {
      attempts++;
      if (attempts < 2) throw new Error('fail');
      return { exists: true, id: 'retry', data: () => ({ success: true }) };
  };

  const retryResult = await helpers.getDoc('col', 'retry');
  assert.strictEqual(retryResult.success, true);
  assert.strictEqual(attempts, 2);
  console.log('PASS');

  // Test 5: runBatch
  console.log('Test 5: runBatch');
  global.sessionStorage.clear();
  // Mock batch commit spy
  let batchCommited = false;
  mockBatch.commit = async () => { batchCommited = true; };

  await helpers.runBatch([
    { type: 'set', collection: 'col', docId: 'd1', data: {a:1} },
    { type: 'update', collection: 'col', docId: 'd2', data: {b:2} }
  ], 'batch_invalidate_key');

  assert.strictEqual(batchCommited, true);
  console.log('PASS');

  console.log('All tests passed!');
}

runTests().catch(e => {
    console.error('Test failed:', e);
    process.exit(1);
});
