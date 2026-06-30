import { put } from '@vercel/blob';

export const config = {
  api: { bodyParser: false },
  maxDuration: 30,
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const contentType = req.headers['content-type'] || 'application/octet-stream';
  if (!ALLOWED.includes(contentType.toLowerCase())) {
    return res.status(400).json({ error: `Tipo no permitido: ${contentType}. Subí JPG, PNG, WEBP o GIF.` });
  }

  const filename = (req.headers['x-filename'] || 'banner.bin')
    .toString()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);

  const chunks = [];
  let total = 0;
  try {
    for await (const chunk of req) {
      total += chunk.length;
      if (total > MAX_BYTES) return res.status(413).json({ error: 'La imagen pesa más de 5 MB.' });
      chunks.push(chunk);
    }
  } catch (err) {
    return res.status(400).json({ error: `Error leyendo el archivo: ${err.message}` });
  }

  if (total === 0) return res.status(400).json({ error: 'Archivo vacío.' });

  const buffer = Buffer.concat(chunks);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `banners/${stamp}-${filename}`;

  try {
    const blob = await put(key, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    });
    return res.status(200).json({ url: blob.url, size: total, contentType });
  } catch (err) {
    return res.status(500).json({ error: `No se pudo subir a Vercel Blob: ${err.message}` });
  }
}
