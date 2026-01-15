// Data migration script: Old Firebase → New Firebase
// Run with: node scripts/migrate-data.js

const admin = require('firebase-admin');

// Initialize OLD project
const oldServiceAccount = require('./old-service-account.json'); // You'll need to download this
const oldApp = admin.initializeApp({
  credential: admin.credential.cert(oldServiceAccount),
  databaseURL: 'https://prompt-sharing-f8eeb.firebaseio.com'
}, 'old');

// Initialize NEW project
const newServiceAccount = require('./new-service-account.json'); // You'll need to download this
const newApp = admin.initializeApp({
  credential: admin.credential.cert(newServiceAccount),
  databaseURL: 'https://promptroot-b02a2.firebaseio.com'
}, 'new');

const oldDb = oldApp.firestore();
const newDb = newApp.firestore();

async function migrateQueues() {
  console.log('🔄 Starting queue migration...');
  
  // Get all users' queues
  const queuesSnapshot = await oldDb.collection('julesQueues').get();
  
  let migrated = 0;
  let skipped = 0;
  
  for (const userDoc of queuesSnapshot.docs) {
    const userId = userDoc.id;
    console.log(`  Checking queue for user: ${userId}`);
    
    // Get all items in this user's queue
    const itemsSnapshot = await oldDb
      .collection('julesQueues')
      .doc(userId)
      .collection('items')
      .get();
    
    // Copy each item to new project (only if it doesn't exist)
    for (const itemDoc of itemsSnapshot.docs) {
      // Check if item already exists in new database
      const existingDoc = await newDb
        .collection('julesQueues')
        .doc(userId)
        .collection('items')
        .doc(itemDoc.id)
        .get();
      
      if (existingDoc.exists) {
        skipped++;
        continue;
      }
      
      const itemData = itemDoc.data();
      await newDb
        .collection('julesQueues')
        .doc(userId)
        .collection('items')
        .doc(itemDoc.id)
        .set(itemData);
      migrated++;
      console.log(`    ✓ Migrated item: ${itemDoc.id}`);
    }
  }
  
  console.log(`✅ Migrated ${migrated} queue items, skipped ${skipped} existing`);
}

async function migrateJulesKeys() {
  console.log('🔄 Starting Jules API keys migration...');
  
  const keysSnapshot = await oldDb.collection('julesKeys').get();
  
  let migrated = 0;
  let skipped = 0;
  
  for (const doc of keysSnapshot.docs) {
    const existingDoc = await newDb.collection('julesKeys').doc(doc.id).get();
    
    if (existingDoc.exists) {
      skipped++;
      continue;
    }
    
    await newDb.collection('julesKeys').doc(doc.id).set(doc.data());
    migrated++;
    console.log(`  ✓ Migrated key: ${doc.id}`);
  }
  
  console.log(`✅ Migrated ${migrated} Jules API keys, skipped ${skipped} existing`);
}

async function migrateUserData() {
  console.log('🔄 Starting user data migration...');
  
  const usersSnapshot = await oldDb.collection('users').get();
  
  let migrated = 0;
  let skipped = 0;
  
  for (const doc of usersSnapshot.docs) {
    const existingDoc = await newDb.collection('users').doc(doc.id).get();
    
    if (existingDoc.exists) {
      skipped++;
      continue;
    }
    
    await newDb.collection('users').doc(doc.id).set(doc.data());
    migrated++;
    console.log(`  ✓ Migrated user: ${doc.id}`);
  }
  
  console.log(`✅ Migrated ${migrated} user records, skipped ${skipped} existing`);
}

async function main() {
  try {
    console.log('📦 Firebase Data Migration Tool');
    console.log('================================\n');
    
    await migrateQueues();
    await migrateJulesKeys();
    await migrateUserData();
    
    console.log('\n🎉 Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
