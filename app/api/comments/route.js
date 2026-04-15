import { NextResponse } from 'next/server';
import { verifyAdmin, corsHeaders } from '@/lib/api-helpers';
import { v4 as uuidv4 } from 'uuid';

// GET /api/comments?songId=xxx
export async function GET(request) {
  try {
    const { getDb } = await import('@/lib/db');
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
  } catch (error) {
    console.error('GET comments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// POST /api/comments
export async function POST(request) {
  try {
    const { getDb } = await import('@/lib/db');
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
  } catch (error) {
    console.error('POST comments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// DELETE /api/comments?id=xxx
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
    const result = await db.collection('comments').deleteOne({ id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ message: 'Comment deleted successfully' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('DELETE comments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// OPTIONS
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}