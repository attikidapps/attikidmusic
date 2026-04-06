import { MongoClient } from 'mongodb';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// --- Database Connection ---
let cachedClient = null;
let cachedDb = null;

async function getDb() {
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

// --- Admin Authentication ---
const ADMIN_SECRET_SALT = 'attikid-music-platform-2025';

function generateAdminToken() {
  const password = process.env.ADMIN_PASSWORD || 'attikid';
  return crypto.createHash('sha256').update(password + ADMIN_SECRET_SALT).digest('hex');
}

function verifyAdmin(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7);
  return token === generateAdminToken();
}

// --- CORS Headers ---
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// --- Ensure songs directory ---
function ensureSongsDir() {
  const songsDir = path.join(process.cwd(), 'public', 'songs');
  if (!fs.existsSync(songsDir)) {
    fs.mkdirSync(songsDir, { recursive: true });
  }
  return songsDir;
}

// === GET Handler ===
export async function GET(request, { params }) {
  const pathSegments = params.path || [];
  const route = pathSegments.join('/');

  try {
    switch (route) {
      case 'songs':
        return handleGetSongs(request);
      case 'comments':
        return handleGetComments(request);
      case 'comments/all':
        return handleGetAllComments(request);
      case 'health':
        return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() }, { headers: corsHeaders() });
      default:
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
    }
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// === POST Handler ===
export async function POST(request, { params }) {
  const pathSegments = params.path || [];
  const route = pathSegments.join('/');

  try {
    switch (route) {
      case 'likes':
        return handlePostLike(request);
      case 'comments':
        return handlePostComment(request);
      case 'plays':
        return handlePostPlay(request);
      case 'admin/login':
        return handleAdminLogin(request);
      case 'upload':
        return handleUpload(request);
      default:
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
    }
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// === PUT Handler ===
export async function PUT(request, { params }) {
  const pathSegments = params.path || [];
  const route = pathSegments.join('/');

  try {
    switch (route) {
      case 'songs':
        return handlePutSong(request);
      default:
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
    }
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// === DELETE Handler ===
export async function DELETE(request, { params }) {
  const pathSegments = params.path || [];
  const route = pathSegments.join('/');

  try {
    switch (route) {
      case 'songs':
        return handleDeleteSong(request);
      case 'comments':
        return handleDeleteComment(request);
      default:
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
    }
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// === OPTIONS Handler ===
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// ============================
// Handler Functions
// ============================

// GET /api/songs
async function handleGetSongs() {
  const db = await getDb();
  const songs = await db.collection('songs').find({}).sort({ createdAt: -1 }).limit(200).toArray();
  const cleanSongs = songs.map(({ _id, ...rest }) => rest);
  return NextResponse.json({ songs: cleanSongs }, { headers: corsHeaders() });
}

// GET /api/comments?songId=xxx
async function handleGetComments(request) {
  const { searchParams } = new URL(request.url);
  const songId = searchParams.get('songId');

  if (!songId) {
    return NextResponse.json({ error: 'songId is required' }, { status: 400, headers: corsHeaders() });
  }

  const db = await getDb();
  const comments = await db.collection('comments')
    .find({ songId })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  const cleanComments = comments.map(({ _id, ...rest }) => rest);
  return NextResponse.json({ comments: cleanComments }, { headers: corsHeaders() });
}

// GET /api/comments/all - fetch all comments in one query (admin)
async function handleGetAllComments(request) {
  const db = await getDb();
  const comments = await db.collection('comments').find({}).sort({ createdAt: -1 }).limit(500).toArray();
  const songs = await db.collection('songs').find({}).project({ id: 1, title: 1, _id: 0 }).toArray();
  const songMap = {};
  songs.forEach(s => { songMap[s.id] = s.title; });
  const cleanComments = comments.map(({ _id, ...rest }) => ({
    ...rest,
    songTitle: songMap[rest.songId] || 'Unknown',
  }));
  return NextResponse.json({ comments: cleanComments }, { headers: corsHeaders() });
}

// POST /api/likes
async function handlePostLike(request) {
  const body = await request.json();
  const { songId } = body;

  if (!songId) {
    return NextResponse.json({ error: 'songId is required' }, { status: 400, headers: corsHeaders() });
  }

  const db = await getDb();
  const result = await db.collection('songs').findOneAndUpdate(
    { id: songId },
    { $inc: { likes: 1 } },
    { returnDocument: 'after' }
  );

  if (!result) {
    return NextResponse.json({ error: 'Song not found' }, { status: 404, headers: corsHeaders() });
  }

  return NextResponse.json({ likes: result.likes }, { headers: corsHeaders() });
}

// POST /api/comments
async function handlePostComment(request) {
  const body = await request.json();
  const { songId, name, text } = body;

  if (!songId || !text || !text.trim()) {
    return NextResponse.json({ error: 'songId and text are required' }, { status: 400, headers: corsHeaders() });
  }

  // Sanitize
  const sanitizedText = text.trim().substring(0, 500);
  const sanitizedName = name && name.trim() ? name.trim().substring(0, 50) : 'Anonymous';

  const comment = {
    id: uuidv4(),
    songId,
    name: sanitizedName,
    text: sanitizedText,
    createdAt: new Date().toISOString(),
  };

  const db = await getDb();
  await db.collection('comments').insertOne(comment);

  // Return without _id
  const { _id, ...cleanComment } = comment;
  return NextResponse.json({ comment: cleanComment }, { status: 201, headers: corsHeaders() });
}

// POST /api/plays
async function handlePostPlay(request) {
  const body = await request.json();
  const { songId } = body;

  if (!songId) {
    return NextResponse.json({ error: 'songId is required' }, { status: 400, headers: corsHeaders() });
  }

  const db = await getDb();
  const result = await db.collection('songs').findOneAndUpdate(
    { id: songId },
    { $inc: { plays: 1 } },
    { returnDocument: 'after' }
  );

  if (!result) {
    return NextResponse.json({ error: 'Song not found' }, { status: 404, headers: corsHeaders() });
  }

  return NextResponse.json({ plays: result.plays }, { headers: corsHeaders() });
}

// POST /api/admin/login
async function handleAdminLogin(request) {
  const body = await request.json();
  const { username, password } = body;

  const adminPassword = process.env.ADMIN_PASSWORD || 'attikid';

  if (username !== 'admin' || password !== adminPassword) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401, headers: corsHeaders() });
  }

  const token = generateAdminToken();
  return NextResponse.json({ token, message: 'Login successful' }, { headers: corsHeaders() });
}

// POST /api/upload
async function handleUpload(request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const title = formData.get('title');

  if (!file || !title) {
    return NextResponse.json({ error: 'File and title are required' }, { status: 400, headers: corsHeaders() });
  }

  // Validate file type
  const fileName = file.name || '';
  if (!fileName.endsWith('.mp3') && !fileName.endsWith('.wav') && !fileName.endsWith('.ogg') && !fileName.endsWith('.m4a')) {
    return NextResponse.json({ error: 'Only audio files (mp3, wav, ogg, m4a) are allowed' }, { status: 400, headers: corsHeaders() });
  }

  // Save file
  const songsDir = ensureSongsDir();
  const ext = path.extname(fileName) || '.mp3';
  const filename = `${uuidv4()}${ext}`;
  const filepath = path.join(songsDir, filename);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  fs.writeFileSync(filepath, buffer);

  // Create song record
  const song = {
    id: uuidv4(),
    title: title.trim(),
    filename,
    likes: 0,
    plays: 0,
    createdAt: new Date().toISOString(),
  };

  const db = await getDb();
  await db.collection('songs').insertOne(song);

  const { _id, ...cleanSong } = song;
  return NextResponse.json({ song: cleanSong }, { status: 201, headers: corsHeaders() });
}

// PUT /api/songs
async function handlePutSong(request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
  }

  const body = await request.json();
  const { id, title } = body;

  if (!id || !title) {
    return NextResponse.json({ error: 'id and title are required' }, { status: 400, headers: corsHeaders() });
  }

  const db = await getDb();
  const result = await db.collection('songs').findOneAndUpdate(
    { id },
    { $set: { title: title.trim() } },
    { returnDocument: 'after' }
  );

  if (!result) {
    return NextResponse.json({ error: 'Song not found' }, { status: 404, headers: corsHeaders() });
  }

  const { _id, ...cleanSong } = result;
  return NextResponse.json({ song: cleanSong }, { headers: corsHeaders() });
}

// DELETE /api/songs?id=xxx
async function handleDeleteSong(request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400, headers: corsHeaders() });
  }

  const db = await getDb();
  const song = await db.collection('songs').findOne({ id });

  if (!song) {
    return NextResponse.json({ error: 'Song not found' }, { status: 404, headers: corsHeaders() });
  }

  // Delete file
  try {
    const filepath = path.join(process.cwd(), 'public', 'songs', song.filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  } catch (err) {
    console.error('Error deleting file:', err);
  }

  // Delete song record
  await db.collection('songs').deleteOne({ id });
  // Delete associated comments
  await db.collection('comments').deleteMany({ songId: id });

  return NextResponse.json({ message: 'Song deleted successfully' }, { headers: corsHeaders() });
}

// DELETE /api/comments?id=xxx
async function handleDeleteComment(request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400, headers: corsHeaders() });
  }

  const db = await getDb();
  const result = await db.collection('comments').deleteOne({ id });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404, headers: corsHeaders() });
  }

  return NextResponse.json({ message: 'Comment deleted successfully' }, { headers: corsHeaders() });
}
