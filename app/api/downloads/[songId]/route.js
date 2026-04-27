import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db'; // or wherever your admin client lives

export async function GET(req, { params }) {
  const { songId } = params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(songId)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const sessionId = req.headers.get('x-session-id') || '';
  if (!sessionId || sessionId.length > 64) {
    return NextResponse.json({ error: 'session required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: song, error } = await supabase
    .from('songs')
    .select('id, title, url, downloadable')
    .eq('id', songId)
    .single();

  if (error || !song) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (song.downloadable === false) return NextResponse.json({ error: 'disabled' }, { status: 403 });

  const safeTitle = (song.title || 'song').replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim().slice(0, 80) || 'song';
  const filename = `${safeTitle}.mp3`;
  const sep = song.url.includes('?') ? '&' : '?';
  const url = `${song.url}${sep}download=${encodeURIComponent(filename)}`;

  // Fire-and-forget tracking
  supabase.rpc('increment_downloads', { p_song_id: songId }).then(() => {});

  return NextResponse.json({ url, filename });
}
