import { NextResponse } from 'next/server';
import { verifyAdmin, corsHeaders } from '@/lib/api-helpers';
import fs from 'fs';
import path from 'path';

// GET /api/songs
export async function GET() {
  try {
    const { getDb } = await import('@/lib/db');
    const db = await getDb();
    const songs = await db.collection('songs').find({}).sort({ createdAt: -1 }).limit(200).toArray();
    const cleanSongs = songs.map(({ _id, ...rest }) => rest);
    return NextResponse.json({ songs: cleanSongs }, { headers: corsHeaders() });
  } catch (error) {
    console.error('GET songs error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// PUT /api/songs
export async function PUT(request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
  }

  try {
    const { getDb } = await import('@/lib/db');
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
  } catch (error) {
    console.error('PUT songs error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// DELETE /api/songs?id=xxx
export async function DELETE(request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
  }

  try {
    const { getDb } = await import('@/lib/db');
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
  } catch (error) {
    console.error('DELETE songs error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// OPTIONS
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}