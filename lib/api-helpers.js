import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// --- Admin Authentication ---
const ADMIN_SECRET_SALT = 'attikid-music-platform-2025';

function generateAdminToken() {
  const password = process.env.ADMIN_PASSWORD || 'attikid';
  return crypto.createHash('sha256').update(password + ADMIN_SECRET_SALT).digest('hex');
}

export function verifyAdmin(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7);
  return token === generateAdminToken();
}

// --- CORS Headers ---
export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// --- Ensure songs directory ---
export function ensureSongsDir() {
  const songsDir = path.join(process.cwd(), 'public', 'songs');
  if (!fs.existsSync(songsDir)) {
    fs.mkdirSync(songsDir, { recursive: true });
  }
  return songsDir;
}