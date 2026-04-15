import { NextResponse } from 'next/server';
import { verifyAdmin, corsHeaders, ensureSongsDir } from '@/lib/api-helpers';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// POST /api/upload
export async function POST(request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
  }

  try {
    const { getDb } = await import('@/lib/db');
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
  } catch (error) {
    console.error('POST upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// OPTIONS
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}