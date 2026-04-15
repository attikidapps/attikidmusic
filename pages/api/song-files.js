import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const songsDir = path.join(process.cwd(), 'public', 'songs');

  let files = [];
  try {
    files = fs.readdirSync(songsDir);
  } catch (error) {
    return res.status(200).json([]);
  }

  const mp3s = files.filter((file) => file.endsWith('.mp3'));
  return res.status(200).json(mp3s);
}
