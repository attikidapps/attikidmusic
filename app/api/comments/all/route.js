import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/api-helpers';

// GET /api/comments/all - fetch all comments in one query (admin)
export async function GET() {
  try {
    const { getDb } = await import('@/lib/db');
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
  } catch (error) {
    console.error('GET comments/all error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// OPTIONS
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}