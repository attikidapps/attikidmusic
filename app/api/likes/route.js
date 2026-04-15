import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/api-helpers';

// POST /api/likes
export async function POST(request) {
  try {
    const { getDb } = await import('@/lib/db');
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
  } catch (error) {
    console.error('POST likes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// OPTIONS
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}