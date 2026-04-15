import { MongoClient } from 'mongodb';

// --- Database Connection ---
let cachedClient = null;
let cachedDb = null;

export async function getDb() {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  cachedClient = client;
  const dbName = process.env.DB_NAME && process.env.DB_NAME !== 'your_database_name'
    ? process.env.DB_NAME
    : 'music_platform';
  cachedDb = client.db(dbName);

  // Create indexes
  await cachedDb.collection('songs').createIndex({ id: 1 }, { unique: true });
  await cachedDb.collection('comments').createIndex({ id: 1 }, { unique: true });
  await cachedDb.collection('comments').createIndex({ songId: 1 });

  return cachedDb;
}