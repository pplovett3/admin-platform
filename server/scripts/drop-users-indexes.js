// Drop problematic indexes on users collection to fix startup E11000 issues
// Usage: node scripts/drop-users-indexes.js
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/admin_platform';
  console.log(`[drop-users-indexes] connecting to ${uri}`);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const coll = db.collection('users');
  try {
    const idx = await coll.indexes();
    console.log('[drop-users-indexes] existing indexes:', idx.map(i => i.name));
  } catch {}
  try {
    await coll.dropIndex('email_1');
    console.log('[drop-users-indexes] dropped index email_1');
  } catch (e) {
    console.log('[drop-users-indexes] dropIndex email_1 skipped:', e?.message || e);
  }
  try {
    // As a fallback, drop all non-default indexes (Mongo will keep _id_)
    await coll.dropIndexes();
    console.log('[drop-users-indexes] dropped all secondary indexes');
  } catch (e) {
    console.log('[drop-users-indexes] dropIndexes skipped:', e?.message || e);
  }
  await mongoose.disconnect();
  console.log('[drop-users-indexes] done');
}

main().catch(err => {
  console.error('[drop-users-indexes] error', err);
  process.exit(1);
});


