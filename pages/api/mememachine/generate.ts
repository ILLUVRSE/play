import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

type Data =
  | { b64_png: string; width: number; height: number; aspect: string }
  | { error: string };

const rateMap = new Map<string, { count: number; last: number }>();
const WINDOW = 5000;
const BURST = 3;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb'
    }
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'local';
  const now = Date.now();
  const entry = rateMap.get(ip) ?? { count: 0, last: now };
  const elapsed = now - entry.last;
  const count = elapsed > WINDOW ? 1 : entry.count + 1;
  if (elapsed <= WINDOW && count > BURST) {
    return res.status(429).json({ error: 'Too many requests, slow down' });
  }
  rateMap.set(ip, { count, last: now });

  const { idea = '', topText = '', bottomText = '', style = 'clean', aspect = '1:1', mode = 'image' } =
    req.body || {};

  const cleanIdea = String(idea).trim();
  const top = String(topText).trim();
  const bottom = String(bottomText).trim();
  const aspectKey = aspect === '4:5' || aspect === '16:9' ? aspect : '1:1';

  if (cleanIdea.length < 3 || cleanIdea.length > 400) {
    return res.status(400).json({ error: 'Idea must be 3-400 characters' });
  }
  if (top.length > 80 || bottom.length > 80) {
    return res.status(400).json({ error: 'Top/Bottom text max 80 chars' });
  }
  if (mode === 'gif') {
    return res.status(400).json({ error: 'GIF mode coming soon' });
  }

  const serverKey = process.env.OPENAI_API_KEY;
  const headerKey = typeof req.headers['x-openai-key'] === 'string' ? (req.headers['x-openai-key'] as string).trim() : '';
  const effectiveKey = serverKey || headerKey;

  if (!effectiveKey) {
    return res.status(400).json({ error: 'No OpenAI key configured. Add OPENAI_API_KEY on server or set it in /control.' });
  }

  if (!serverKey) {
    const validPrefix = headerKey.startsWith('sk-') || headerKey.startsWith('sk-proj-');
    if (!validPrefix) {
      return res.status(400).json({ error: 'Invalid OpenAI key format' });
    }
  }

  const aspectMap: Record<'1:1' | '4:5' | '16:9', { size: '1024x1024' | '1024x1792' | '1792x1024'; width: number; height: number }> = {
    '1:1': { size: '1024x1024', width: 1024, height: 1024 },
    '4:5': { size: '1024x1792', width: 1024, height: 1792 },
    '16:9': { size: '1792x1024', width: 1792, height: 1024 }
  };

  const { size, width, height } = aspectMap[aspectKey];

  const prompt = [
    `Create a meme image in ${style} style.`,
    `Concept: ${cleanIdea}`,
    top ? `Place top text: "${top}"` : '',
    bottom ? `Place bottom text: "${bottom}"` : '',
    'Clear, legible meme text, balanced composition.',
    'Safe content. No hateful, violent, or sexual minors content.',
    'Use simple backgrounds and high contrast text.'
  ]
    .filter(Boolean)
    .join(' ');

  const client = new OpenAI({ apiKey: effectiveKey });

  try {
    const image = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      size
    });
    const b64_png = image.data?.[0]?.b64_json;
    if (!b64_png) {
      return res.status(500).json({ error: 'Failed to generate image' });
    }
    return res.status(200).json({ b64_png, width, height, aspect: aspectKey });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const message = err?.message || 'Unable to generate meme';
    return res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
  }
}
